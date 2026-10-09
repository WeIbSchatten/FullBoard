package model

// ClientTgWebProxy binds a client to a tg-web-proxy profile; Dedicated clients
// get a per-client profile cloned from ProfileName instead of its own secret.
type ClientTgWebProxy struct {
	Id          int    `json:"id" gorm:"primaryKey;autoIncrement"`
	ClientId    int    `json:"clientId" gorm:"column:client_id;uniqueIndex;not null"`
	ProfileName string `json:"profileName" gorm:"column:profile_name;not null"`
	Dedicated   bool   `json:"dedicated" gorm:"column:dedicated;default:false"`
	CreatedAt   int64  `json:"createdAt" gorm:"autoCreateTime:milli"`
}

func (ClientTgWebProxy) TableName() string { return "client_tg_web_proxy" }
