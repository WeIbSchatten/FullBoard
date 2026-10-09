package web

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/cookiejar"
	"strings"
	"testing"

	"github.com/WeIbSchatten/FullBoard/v3/internal/database/model"
)

type ticketLoginClient struct {
	t      *testing.T
	base   string
	client *http.Client
	csrf   string
}

func newTicketLoginClient(t *testing.T, base string) *ticketLoginClient {
	t.Helper()
	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}
	c := &ticketLoginClient{t: t, base: base, client: &http.Client{Jar: jar}}
	resp, err := c.client.Get(base + "/csrf-token")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var body struct {
		Obj string `json:"obj"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	c.csrf = body.Obj
	return c
}

func (c *ticketLoginClient) redeem(ticket string) bool {
	c.t.Helper()
	req, _ := http.NewRequest(http.MethodPost, c.base+"/login/ticket", strings.NewReader(`{"ticket":"`+ticket+`"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-CSRF-Token", c.csrf)
	resp, err := c.client.Do(req)
	if err != nil {
		c.t.Fatal(err)
	}
	defer resp.Body.Close()
	var body struct {
		Success bool `json:"success"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&body)
	return body.Success
}

func (c *ticketLoginClient) panelStatus() int {
	c.t.Helper()
	resp, err := c.client.Get(c.base + "/panel/api/server/status")
	if err != nil {
		c.t.Fatal(err)
	}
	defer resp.Body.Close()
	return resp.StatusCode
}

// A master's login-as ticket must open a real browser session on the node,
// exactly once, through the production router.
func TestLoginAsTicketOpensNodeSessionOnce(t *testing.T) {
	node := startContractNode(t)
	master := node.masterWithToken(t, model.ApiScopeAdmin)
	ticket, err := master.IssueLoginTicket(context.Background())
	if err != nil {
		t.Fatalf("IssueLoginTicket: %v", err)
	}

	browser := newTicketLoginClient(t, node.srv.URL)
	if status := browser.panelStatus(); status == http.StatusOK {
		t.Fatal("the browser was signed in before redeeming anything")
	}
	if !browser.redeem(ticket) {
		t.Fatal("a fresh ticket was refused")
	}
	if status := browser.panelStatus(); status != http.StatusOK {
		t.Fatalf("panel status after login-as = %d, want 200", status)
	}

	replay := newTicketLoginClient(t, node.srv.URL)
	if replay.redeem(ticket) {
		t.Fatal("a ticket was redeemed twice")
	}
	if status := replay.panelStatus(); status == http.StatusOK {
		t.Fatal("a replayed ticket produced a session")
	}
}