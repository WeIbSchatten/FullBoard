#!/usr/bin/env bash
# Move a 3x-ui install into We1ssBoard on the same server, or roll it back.
#
#   migrate-3xui.sh migrate [--yes]        back up 3x-ui, import x-ui.db, switch services
#   migrate-3xui.sh rollback [backup-dir] [--yes]  restore 3x-ui exactly as it was before migrate
#   migrate-3xui.sh status                 list migration backups
#
# 3x-ui itself is never modified: migrate only stops and disables x-ui.service and
# reads x-ui.db. We1ssBoard must already be installed (install.sh).

set -Eeuo pipefail

red='\033[0;31m'
green='\033[0;32m'
yellow='\033[0;33m'
plain='\033[0m'

# Overridable the same way install.sh honours XUI_MAIN_FOLDER / XUI_SERVICE.
xui3_folder="${XUI3_MAIN_FOLDER:-/usr/local/x-ui}"
xui3_cli="${XUI3_CLI:-/usr/bin/x-ui}"
fb_folder="${XUI_MAIN_FOLDER:-/usr/local/we1ssboard}"
systemd_dir="${XUI_SERVICE:-/etc/systemd/system}"
backup_root="${MIGRATE_BACKUP_ROOT:-/root}"
xui3_env_files=(/etc/default/x-ui /etc/conf.d/x-ui /etc/sysconfig/x-ui)
fb_env_files=(/etc/default/we1ssboard /etc/conf.d/we1ssboard /etc/sysconfig/we1ssboard)
if [[ -n "${XUI3_ENV_FILE:-}" ]]; then xui3_env_files=("$XUI3_ENV_FILE"); fi
if [[ -n "${WE1SSBOARD_ENV_FILE:-}" ]]; then fb_env_files=("$WE1SSBOARD_ENV_FILE"); fi

info() { echo -e "${green}$*${plain}"; }
warn() { echo -e "${yellow}$*${plain}"; }
die() {
    echo -e "${red}$*${plain}" >&2
    exit 1
}

# env_value FILE... KEY prints KEY's value from the first env file that sets it.
env_value() {
    local key="${*: -1}" f line
    for f in "${@:1:$#-1}"; do
        [[ -r "$f" ]] || continue
        line=$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$f" | tail -n 1) || continue
        line="${line#*=}"
        line="${line%\"}"
        line="${line#\"}"
        line="${line%\'}"
        line="${line#\'}"
        echo "$line"
        return 0
    done
    return 0
}

unit_active() { systemctl is-active --quiet "$1" && echo yes || echo no; }
unit_enabled() { systemctl is-enabled --quiet "$1" 2> /dev/null && echo yes || echo no; }

sqlite_files() { for s in "" -wal -shm -journal; do [[ -e "$1$s" ]] && echo "$1$s"; done; return 0; }

resolve_paths() {
    local folder
    folder="$(env_value "${xui3_env_files[@]}" XUI_DB_FOLDER)"
    xui3_db_folder="${XUI3_DB_FOLDER:-${folder:-/etc/x-ui}}"
    xui3_db="${xui3_db_folder}/x-ui.db"
    folder="$(env_value "${fb_env_files[@]}" XUI_DB_FOLDER)"
    fb_db_folder="${XUI_DB_FOLDER:-${folder:-/etc/we1ssboard}}"
    fb_db="${fb_db_folder}/we1ssboard.db"
    fb_bin="${fb_folder}/we1ssboard"
}

preflight() {
    [[ $EUID -eq 0 ]] || die "Run as root."
    command -v systemctl > /dev/null || die "systemd is required."
    [[ -f "$xui3_db" ]] || die "3x-ui database not found at $xui3_db."
    [[ -x "$fb_bin" ]] || die "We1ssBoard is not installed ($fb_bin missing). Install it first with install.sh."
    if [[ "$(env_value "${xui3_env_files[@]}" XUI_DB_TYPE)" == "postgres" ]]; then
        die "3x-ui uses PostgreSQL; this script migrates the SQLite x-ui.db only."
    fi
    if [[ "$(env_value "${fb_env_files[@]}" XUI_DB_TYPE)" == "postgres" ]]; then
        die "We1ssBoard is configured for PostgreSQL; migrate into SQLite first, then use 'we1ssboard migrate-db --dsn'."
    fi
    command -v tar > /dev/null || die "tar is required."
}

# Every 3x-ui file the rollback must put back, relative to /.
xui3_paths() {
    local p
    for p in "$xui3_db_folder" "$xui3_folder" "$systemd_dir/x-ui.service" "$systemd_dir/x-ui.service.d" "$xui3_cli" "${xui3_env_files[@]}"; do
        [[ -e "$p" ]] && echo "${p#/}"
    done
    return 0
}

save_state() {
    {
        echo "xui3_was_active=$1"
        echo "xui3_was_enabled=$2"
        echo "fb_was_active=$3"
        echo "fb_was_enabled=$4"
        printf 'xui3_db=%q\n' "$xui3_db"
        printf 'fb_db=%q\n' "$fb_db"
        printf 'created=%q\n' "$(date -Is)"
    } > "$backup_dir/state.env"
}

wait_active() {
    local i
    for i in $(seq 1 "${MIGRATE_HEALTH_SECONDS:-20}"); do
        if systemctl is-active --quiet we1ssboard; then
            sleep 3
            systemctl is-active --quiet we1ssboard && return 0
        fi
        sleep 1
    done
    return 1
}

cmd_migrate() {
    local assume_yes="$1"
    resolve_paths
    preflight

    local xui3_active xui3_enabled fb_active fb_enabled
    xui3_active=$(unit_active x-ui)
    xui3_enabled=$(unit_enabled x-ui)
    fb_active=$(unit_active we1ssboard)
    fb_enabled=$(unit_enabled we1ssboard)

    echo "3x-ui database:     $xui3_db (service active: $xui3_active)"
    echo "We1ssBoard database: $fb_db (service active: $fb_active)"
    if [[ -e "$fb_db" ]]; then
        warn "The current We1ssBoard database will be replaced; it goes into the backup and comes back on rollback."
    fi
    echo "x-ui and We1ssBoard will be stopped for a few seconds. We1ssBoard then takes over 3x-ui's"
    echo "panel port, path, login, inbounds, clients and traffic."
    if [[ "$assume_yes" != "yes" ]]; then
        read -r -p "Continue? [y/N]: " answer
        [[ "$answer" == [yY]* ]] || die "Cancelled, nothing changed."
    fi

    backup_dir="${backup_root}/3x-ui-migration-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir/we1ssboard-db"
    chmod 700 "$backup_dir"
    save_state "$xui3_active" "$xui3_enabled" "$fb_active" "$fb_enabled"

    info "Test import while 3x-ui keeps running..."
    if ! "$fb_bin" import-3xui --src "$xui3_db" --dst "$backup_dir/precheck/we1ssboard.db" | tee "$backup_dir/precheck.log"; then
        rm -rf "$backup_dir"
        die "Test import failed; nothing was stopped or changed."
    fi
    rm -rf "$backup_dir/precheck"
    if [[ "$assume_yes" != "yes" ]] && grep -q "WARNING" "$backup_dir/precheck.log"; then
        read -r -p "The test import printed warnings above. Switch to We1ssBoard anyway? [y/N]: " answer
        if [[ "$answer" != [yY]* ]]; then
            rm -rf "$backup_dir"
            die "Cancelled, nothing changed."
        fi
    fi

    info "Stopping services..."
    systemctl stop we1ssboard 2> /dev/null || true
    systemctl stop x-ui 2> /dev/null || true

    info "Backing up 3x-ui to $backup_dir ..."
    xui3_paths > "$backup_dir/3x-ui.paths"
    mapfile -t paths < "$backup_dir/3x-ui.paths"
    tar -C / -cpzf "$backup_dir/3x-ui.tar.gz" "${paths[@]}"
    sha256sum "$xui3_db" | awk '{print $1}' > "$backup_dir/x-ui.db.sha256"
    local f
    while IFS= read -r f; do
        mv "$f" "$backup_dir/we1ssboard-db/"
    done < <(sqlite_files "$fb_db")

    info "Importing x-ui.db into We1ssBoard..."
    if ! "$fb_bin" import-3xui --src "$xui3_db" --dst "$fb_db" | tee "$backup_dir/import.log"; then
        warn "Import failed; restoring the previous state."
        restore_from "$backup_dir"
        die "Migration aborted. 3x-ui is back as it was."
    fi

    systemctl disable x-ui 2> /dev/null || true
    systemctl enable we1ssboard 2> /dev/null || true
    systemctl start we1ssboard
    if ! wait_active; then
        warn "We1ssBoard did not stay up; restoring 3x-ui."
        restore_from "$backup_dir"
        die "Migration aborted. Check 'journalctl -u we1ssboard' and try again."
    fi
    touch "$backup_dir/migrated"

    info "Done. We1ssBoard now runs with the 3x-ui data; log in with the same address and credentials."
    echo "Backup: $backup_dir"
    echo "Roll back to 3x-ui: $(self_command) rollback $backup_dir"
}

# self_command prints how to rerun this script, also when it came from curl via bash <(...).
self_command() {
    if [[ -f "$0" ]]; then
        echo "bash $0"
    else
        echo "bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/We1ssBoard/main/migrate-3xui.sh)"
    fi
}

restore_from() {
    local dir="$1"
    # shellcheck disable=SC1091
    source "$dir/state.env"
    local stamp f
    stamp="$(date +%Y%m%d-%H%M%S)"

    systemctl stop we1ssboard 2> /dev/null || true
    systemctl stop x-ui 2> /dev/null || true

    mapfile -t imported < <(sqlite_files "$fb_db")
    if ((${#imported[@]})); then
        mkdir -p "$dir/we1ssboard-db-imported-$stamp"
        for f in "${imported[@]}"; do mv "$f" "$dir/we1ssboard-db-imported-$stamp/"; done
    fi
    mkdir -p "$(dirname "$fb_db")"
    for f in "$dir"/we1ssboard-db/*; do
        [[ -e "$f" ]] && cp -p "$f" "$(dirname "$fb_db")/"
    done

    local rel
    mkdir -p "$dir/x-ui-replaced-$stamp"
    while IFS= read -r rel; do
        if [[ -e "/$rel" ]]; then
            mkdir -p "$dir/x-ui-replaced-$stamp/$(dirname "$rel")"
            mv "/$rel" "$dir/x-ui-replaced-$stamp/$rel"
        fi
    done < "$dir/3x-ui.paths"
    tar -C / -xpzf "$dir/3x-ui.tar.gz"
    if [[ -f "$dir/x-ui.db.sha256" ]] && [[ "$(sha256sum "$xui3_db" | awk '{print $1}')" != "$(cat "$dir/x-ui.db.sha256")" ]]; then
        die "Restored x-ui.db does not match the backup checksum; files are in $dir."
    fi

    systemctl daemon-reload 2> /dev/null || true
    if [[ "$fb_was_enabled" == yes ]]; then
        systemctl enable we1ssboard 2> /dev/null || true
    else
        systemctl disable we1ssboard 2> /dev/null || true
    fi
    if [[ "$xui3_was_enabled" == yes ]]; then
        systemctl enable x-ui 2> /dev/null || true
    fi
    if [[ "$xui3_was_active" == yes ]]; then
        systemctl start x-ui
    fi
    if [[ "$fb_was_active" == yes ]]; then
        systemctl start we1ssboard
    fi
    rm -f "$dir/migrated"
}

latest_backup() {
    find "$backup_root" -maxdepth 1 -type d -name '3x-ui-migration-*' 2> /dev/null | sort | tail -n 1
}

cmd_rollback() {
    local dir="${1:-$(latest_backup)}"
    [[ $EUID -eq 0 ]] || die "Run as root."
    [[ -n "$dir" && -f "$dir/state.env" && -f "$dir/3x-ui.tar.gz" && -f "$dir/3x-ui.paths" ]] || die "No migration backup found (looked for ${backup_root}/3x-ui-migration-*)."
    echo "Restoring 3x-ui from $dir. We1ssBoard's imported database is kept in that folder."
    if [[ "${2:-}" != "yes" ]]; then
        read -r -p "Continue? [y/N]: " answer
        [[ "$answer" == [yY]* ]] || die "Cancelled, nothing changed."
    fi
    restore_from "$dir"
    info "3x-ui is restored exactly as it was before the migration."
}

cmd_status() {
    local d
    for d in $(find "$backup_root" -maxdepth 1 -type d -name '3x-ui-migration-*' 2> /dev/null | sort); do
        if [[ -f "$d/migrated" ]]; then echo "$d  (migrated, rollback available)"; else echo "$d  (rolled back or aborted)"; fi
    done
}

menu() {
    echo "3x-ui -> We1ssBoard"
    echo "  1) Migrate 3x-ui into We1ssBoard (backup first)"
    echo "  2) Roll back to 3x-ui"
    echo "  3) Show migration backups"
    echo "  0) Exit"
    read -r -p "Choose [0-3]: " choice
    case "$choice" in
        1) cmd_migrate no ;;
        2) cmd_rollback "" no ;;
        3) cmd_status ;;
        *) exit 0 ;;
    esac
}

main() {
    if [[ $# -eq 0 ]]; then
        menu
        return
    fi
    local cmd="${1:-}" yes=no arg=""
    shift || true
    for a in "$@"; do
        case "$a" in
            -y | --yes) yes=yes ;;
            *) arg="$a" ;;
        esac
    done
    case "$cmd" in
        migrate) cmd_migrate "$yes" ;;
        rollback) cmd_rollback "$arg" "$yes" ;;
        status) cmd_status ;;
        *)
            echo "Usage: $(self_command) migrate [--yes] | rollback [backup-dir] [--yes] | status"
            exit 1
            ;;
    esac
}

main "$@"
