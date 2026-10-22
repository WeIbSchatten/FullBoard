package panel

import (
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/WeIbSchatten/We1ssBoard/v3/internal/config"
)

const sampleChangelog = `# Changelog

Intro text the parser must skip.

## [Unreleased]

### Added
- Next thing.

## [1.3.0] - 2026-10-20

Shipped together with 1.2.9.

### Added
- Phone app with
  a wrapped line.
- Settings:
  - tokens;
  - logs.

### Known issues
- Crashes on start. Fixed in 1.3.1.

## [1.2.0] - 2026-10-19

### Fixed
- ` + "`install.sh`" + ` keeps buffers.
`

func TestParseChangelog(t *testing.T) {
	releases, unknown := ParseChangelog(sampleChangelog)
	if len(unknown) != 0 {
		t.Fatalf("unknown headings = %v, want none", unknown)
	}
	want := []ChangelogRelease{
		{Version: "Unreleased", Sections: []ChangelogSection{
			{Kind: "added", Items: []ChangelogItem{{Text: "Next thing."}}},
		}},
		{Version: "1.3.0", Date: "2026-10-20", Note: "Shipped together with 1.2.9.", Sections: []ChangelogSection{
			{Kind: "added", Items: []ChangelogItem{
				{Text: "Phone app with a wrapped line."},
				{Text: "Settings:", Sub: []string{"tokens;", "logs."}},
			}},
			{Kind: "known_issues", Items: []ChangelogItem{{Text: "Crashes on start. Fixed in 1.3.1."}}},
		}},
		{Version: "1.2.0", Date: "2026-10-19", Sections: []ChangelogSection{
			{Kind: "fixed", Items: []ChangelogItem{{Text: "`install.sh` keeps buffers."}}},
		}},
	}
	if !reflect.DeepEqual(releases, want) {
		t.Fatalf("ParseChangelog =\n%+v\nwant\n%+v", releases, want)
	}
}

func TestParseChangelogRussianHeadings(t *testing.T) {
	md := "## [1.0.0] - 2026-10-09\n\n### Несовместимые изменения\n- Переименование.\n\n### Известные проблемы\n- Падает.\n\n### Раздел с опечаткой\n- Пропадёт.\n"
	releases, unknown := ParseChangelog(md)
	kinds := []string{}
	for _, s := range releases[0].Sections {
		kinds = append(kinds, s.Kind)
	}
	if want := []string{"breaking", "known_issues"}; !slices.Equal(kinds, want) {
		t.Fatalf("kinds = %v, want %v", kinds, want)
	}
	if want := []string{"Раздел с опечаткой"}; !slices.Equal(unknown, want) {
		t.Fatalf("unknown = %v, want %v", unknown, want)
	}
}

func TestSelectChangelog(t *testing.T) {
	releases, _ := ParseChangelog(sampleChangelog)
	versions := func(rs []ChangelogRelease) []string {
		out := []string{}
		for _, r := range rs {
			out = append(out, r.Version)
		}
		return out
	}
	cases := []struct {
		name string
		info PanelUpdateInfo
		want []string
	}{
		{"update lists every version after the installed one", PanelUpdateInfo{Channel: "stable", CurrentVersion: "1.1.0", LatestVersion: "v1.3.0", UpdateAvailable: true}, []string{"1.3.0", "1.2.0"}},
		{"update skips the installed version itself", PanelUpdateInfo{Channel: "stable", CurrentVersion: "1.2.0", LatestVersion: "v1.3.0", UpdateAvailable: true}, []string{"1.3.0"}},
		{"up to date shows what the installed version brought", PanelUpdateInfo{Channel: "stable", CurrentVersion: "1.2.0", LatestVersion: "v1.2.0"}, []string{"1.2.0"}},
		{"dev channel shows the unreleased work", PanelUpdateInfo{Channel: "dev", CurrentVersion: "1.3.0", LatestVersion: "dev+abc1234", UpdateAvailable: true}, []string{"Unreleased"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := versions(SelectChangelog(releases, &tc.info)); !slices.Equal(got, tc.want) {
				t.Fatalf("SelectChangelog = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestFetchChangelogFallsBackToEnglish(t *testing.T) {
	var paths []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.URL.Path)
		if strings.HasSuffix(r.URL.Path, "/v1.3.0/CHANGELOG.md") {
			_, _ = w.Write([]byte(sampleChangelog))
			return
		}
		http.NotFound(w, r)
	}))
	defer srv.Close()

	md, file, err := fetchChangelog(srv.Client(), srv.URL, "v1.3.0", "ru-RU")
	if err != nil {
		t.Fatalf("fetchChangelog: %v", err)
	}
	if md != sampleChangelog || file != "CHANGELOG.md" {
		t.Fatalf("got file %q (%d bytes), want the English changelog", file, len(md))
	}
	if want := []string{"/v1.3.0/CHANGELOG.ru_RU.md", "/v1.3.0/CHANGELOG.md"}; !slices.Equal(paths, want) {
		t.Fatalf("requested %v, want %v", paths, want)
	}
}

// Both changelogs ship in every tag and feed the update dialog; a release bump without an
// entry, a version missing from one language or a mistyped heading would show nothing.
func TestRepoChangelogsCoverEveryRelease(t *testing.T) {
	read := func(name string) []ChangelogRelease {
		t.Helper()
		raw, err := os.ReadFile("../../../../" + name)
		if err != nil {
			t.Fatalf("read %s: %v", name, err)
		}
		releases, unknown := ParseChangelog(string(raw))
		if len(unknown) != 0 {
			t.Fatalf("%s has unknown section headings %v", name, unknown)
		}
		return releases
	}
	versionsOf := func(rs []ChangelogRelease) []string {
		out := []string{}
		for _, r := range rs {
			if len(r.Sections) == 0 {
				t.Fatalf("release %s has no sections", r.Version)
			}
			out = append(out, r.Version)
		}
		return out
	}
	en := versionsOf(read("CHANGELOG.md"))
	ru := versionsOf(read("CHANGELOG.ru_RU.md"))
	if !slices.Equal(en, ru) {
		t.Fatalf("CHANGELOG.md versions %v differ from CHANGELOG.ru_RU.md %v", en, ru)
	}
	if current := config.GetBaseVersion(); !slices.Contains(en, current) {
		t.Fatalf("internal/config/version is %s but CHANGELOG.md has no entry for it", current)
	}
}
