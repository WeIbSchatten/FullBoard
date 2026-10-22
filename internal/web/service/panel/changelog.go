package panel

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/WeIbSchatten/We1ssBoard/v3/internal/config"
	"github.com/WeIbSchatten/We1ssBoard/v3/internal/util/version"
	"github.com/WeIbSchatten/We1ssBoard/v3/internal/web/service"
)

const (
	changelogBaseURL  = "https://raw.githubusercontent.com/WeIbSchatten/We1ssBoard"
	changelogPageURL  = "https://github.com/WeIbSchatten/We1ssBoard/blob/"
	changelogEnglish  = "CHANGELOG.md"
	changelogRussian  = "CHANGELOG.ru_RU.md"
	maxChangelogBytes = 1 << 20
	unreleasedVersion = "Unreleased"
)

// ChangelogItem is one bullet; Sub holds its nested bullets.
type ChangelogItem struct {
	Text string   `json:"text" example:"Hysteria keeps its UDP buffers across reboots."`
	Sub  []string `json:"sub,omitempty"`
}

// ChangelogSection groups a release's bullets by kind: added, changed, fixed,
// removed, breaking or known_issues.
type ChangelogSection struct {
	Kind  string          `json:"kind" example:"fixed"`
	Items []ChangelogItem `json:"items"`
}

type ChangelogRelease struct {
	Version  string             `json:"version" example:"1.8.4"`
	Date     string             `json:"date,omitempty" example:"2026-10-20"`
	Note     string             `json:"note,omitempty"`
	Sections []ChangelogSection `json:"sections"`
}

// PanelChangelog is what the update dialog shows: the releases between the installed
// version and the latest one (or the installed one when nothing is newer).
type PanelChangelog struct {
	CurrentVersion string             `json:"currentVersion" example:"1.8.3"`
	LatestVersion  string             `json:"latestVersion" example:"v1.8.4"`
	URL            string             `json:"url" example:"https://github.com/WeIbSchatten/We1ssBoard/blob/v1.8.4/CHANGELOG.md"`
	Releases       []ChangelogRelease `json:"releases"`
}

var (
	changelogVersionRe = regexp.MustCompile(`^## \[([^\]]+)\](?:\s+-\s+(\d{4}-\d{2}-\d{2}))?`)
	changelogKinds     = map[string]string{
		"added": "added", "добавлено": "added",
		"changed": "changed", "изменено": "changed",
		"fixed": "fixed", "исправлено": "fixed",
		"removed": "removed", "удалено": "removed",
		"breaking": "breaking", "несовместимые изменения": "breaking",
		"known issues": "known_issues", "известные проблемы": "known_issues",
	}
)

// ParseChangelog reads a Keep a Changelog file in either language. Sections under a
// heading it does not know are dropped and their headings returned, so tests catch typos.
func ParseChangelog(md string) ([]ChangelogRelease, []string) {
	var releases []ChangelogRelease
	var unknown []string
	var rel *ChangelogRelease
	var sec *ChangelogSection
	var item *ChangelogItem
	skipping := false

	for _, raw := range strings.Split(strings.ReplaceAll(md, "\r\n", "\n"), "\n") {
		line := strings.TrimRight(raw, " \t")
		trimmed := strings.TrimSpace(line)
		switch {
		case strings.HasPrefix(line, "## "):
			releases = append(releases, ChangelogRelease{Sections: []ChangelogSection{}})
			rel = &releases[len(releases)-1]
			if m := changelogVersionRe.FindStringSubmatch(line); m != nil {
				rel.Version, rel.Date = m[1], m[2]
			} else {
				rel.Version = strings.TrimSpace(strings.TrimPrefix(line, "## "))
			}
			sec, item, skipping = nil, nil, false
		case rel == nil:
		case strings.HasPrefix(line, "### "):
			heading := strings.TrimSpace(strings.TrimPrefix(line, "### "))
			kind, ok := changelogKinds[strings.ToLower(heading)]
			if !ok {
				unknown = append(unknown, heading)
				sec, item, skipping = nil, nil, true
				continue
			}
			rel.Sections = append(rel.Sections, ChangelogSection{Kind: kind, Items: []ChangelogItem{}})
			sec, item, skipping = &rel.Sections[len(rel.Sections)-1], nil, false
		case skipping || trimmed == "":
		case sec == nil:
			rel.Note = joinChangelogLine(rel.Note, trimmed)
		case strings.HasPrefix(line, "- "):
			sec.Items = append(sec.Items, ChangelogItem{Text: strings.TrimPrefix(line, "- ")})
			item = &sec.Items[len(sec.Items)-1]
		case item != nil && strings.HasPrefix(trimmed, "- "):
			item.Sub = append(item.Sub, strings.TrimPrefix(trimmed, "- "))
		case item != nil && len(item.Sub) > 0 && strings.HasPrefix(line, "    "):
			last := len(item.Sub) - 1
			item.Sub[last] = joinChangelogLine(item.Sub[last], trimmed)
		case item != nil:
			item.Text = joinChangelogLine(item.Text, trimmed)
		}
	}
	return releases, unknown
}

func joinChangelogLine(text, more string) string {
	if text == "" {
		return more
	}
	return text + " " + more
}

// SelectChangelog picks what the update dialog lists for this install: the dev channel
// gets the unreleased work, a stable update every version after the installed one.
func SelectChangelog(releases []ChangelogRelease, info *PanelUpdateInfo) []ChangelogRelease {
	out := []ChangelogRelease{}
	for _, r := range releases {
		switch {
		case info.Channel == "dev":
			if r.Version == unreleasedVersion {
				out = append(out, r)
			}
		case r.Version == unreleasedVersion:
		case info.UpdateAvailable:
			afterCurrent, ok1 := version.Compare(r.Version, info.CurrentVersion)
			upToLatest, ok2 := version.Compare(r.Version, info.LatestVersion)
			if ok1 && ok2 && afterCurrent > 0 && upToLatest <= 0 {
				out = append(out, r)
			}
		case version.Normalize(r.Version) == version.Normalize(info.CurrentVersion):
			out = append(out, r)
		}
	}
	return out
}

// fetchChangelog downloads the changelog at ref, in Russian for ru/uk panels when that
// file exists, otherwise in English. It returns the text and the file it came from.
func fetchChangelog(client *http.Client, base, ref, lang string) (string, string, error) {
	files := []string{changelogEnglish}
	if l := strings.ToLower(lang); strings.HasPrefix(l, "ru") || strings.HasPrefix(l, "uk") {
		files = []string{changelogRussian, changelogEnglish}
	}
	var lastErr error
	for _, file := range files {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, base+"/"+ref+"/"+file, nil)
		if err != nil {
			cancel()
			return "", "", err
		}
		resp, err := client.Do(req)
		if err != nil {
			cancel()
			lastErr = err
			continue
		}
		body, err := io.ReadAll(io.LimitReader(resp.Body, maxChangelogBytes))
		resp.Body.Close()
		cancel()
		if err != nil {
			lastErr = err
			continue
		}
		if resp.StatusCode != http.StatusOK {
			lastErr = fmt.Errorf("GET %s: %s", file, resp.Status)
			continue
		}
		return string(body), file, nil
	}
	if lastErr == nil {
		lastErr = errors.New("no changelog file to fetch")
	}
	return "", "", lastErr
}

// GetChangelog returns the changelog entries the update dialog shows, read from the
// latest release tag (or main on the dev channel) so it lists versions this build predates.
func (s *PanelService) GetChangelog(lang string) (*PanelChangelog, error) {
	info, err := s.GetUpdateInfo()
	if err != nil {
		return nil, err
	}
	ref := info.LatestVersion
	if info.Channel == "dev" {
		ref = "main"
	}
	client := (&service.SettingService{}).NewProxiedHTTPClient(10 * time.Second)
	md, file, err := fetchChangelog(client, changelogBaseURL, ref, lang)
	if err != nil {
		return nil, err
	}
	releases, _ := ParseChangelog(md)
	return &PanelChangelog{
		CurrentVersion: config.GetBaseVersion(),
		LatestVersion:  info.LatestVersion,
		URL:            changelogPageURL + ref + "/" + file,
		Releases:       SelectChangelog(releases, info),
	}, nil
}
