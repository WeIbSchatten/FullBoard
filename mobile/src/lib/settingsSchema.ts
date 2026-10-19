import type { SettingCategory } from './settingsModel';

// Mirrors the web panel's settings tabs (frontend/src/pages/settings), same keys and labels.
export const SETTING_CATEGORIES: SettingCategory[] = [
  {
    id: 'general',
    title: 'pages.settings.panelSettings',
    sections: [
      {
        title: 'pages.settings.panelSettings',
        fields: [
          { key: 'webListen', kind: 'text', label: 'pages.settings.panelListeningIP', hint: 'pages.settings.panelListeningIPDesc' },
          { key: 'webDomain', kind: 'text', label: 'pages.settings.panelListeningDomain', hint: 'pages.settings.panelListeningDomainDesc' },
          { key: 'webPort', kind: 'number', label: 'pages.settings.panelPort', hint: 'pages.settings.panelPortDesc' },
          { key: 'webBasePath', kind: 'text', label: 'pages.settings.panelUrlPath', hint: 'pages.settings.panelUrlPathDesc' },
          { key: 'sessionMaxAge', kind: 'number', label: 'pages.settings.sessionMaxAge', hint: 'pages.settings.sessionMaxAgeDesc' },
          { key: 'trustedProxyCIDRs', kind: 'text', label: 'pages.settings.trustedProxyCidrs', hint: 'pages.settings.trustedProxyCidrsDesc' },
          { key: 'realityScanCandidates', kind: 'multiline', label: 'pages.settings.realityScanCandidates', hint: 'pages.settings.realityScanCandidatesDesc' },
          { key: 'ipLimitAllowlist', kind: 'text', label: 'pages.settings.ipLimitAllowlist', hint: 'pages.settings.ipLimitAllowlistDesc' },
          { key: 'panelOutbound', kind: 'text', label: 'pages.settings.panelOutbound', hint: 'pages.settings.panelOutboundDesc' },
          { key: 'pageSize', kind: 'number', label: 'pages.settings.pageSize', hint: 'pages.settings.pageSizeDesc' },
          { key: 'restartXrayOnClientDisable', kind: 'bool', label: 'pages.settings.restartXrayOnClientDisable', hint: 'pages.settings.restartXrayOnClientDisableDesc' },
        ],
      },
      {
        title: 'pages.settings.notifications',
        fields: [
          { key: 'expireDiff', kind: 'number', label: 'pages.settings.expireTimeDiff', hint: 'pages.settings.expireTimeDiffDesc' },
          { key: 'trafficDiff', kind: 'number', label: 'pages.settings.trafficDiff', hint: 'pages.settings.trafficDiffDesc' },
        ],
      },
      {
        title: 'pages.settings.certs',
        fields: [
          { key: 'webCertFile', kind: 'text', label: 'pages.settings.publicKeyPath', hint: 'pages.settings.publicKeyPathDesc' },
          { key: 'webKeyFile', kind: 'text', label: 'pages.settings.privateKeyPath', hint: 'pages.settings.privateKeyPathDesc' },
        ],
      },
      {
        title: 'pages.settings.externalTraffic',
        fields: [
          { key: 'externalTrafficInformEnable', kind: 'bool', label: 'pages.settings.externalTrafficInformEnable', hint: 'pages.settings.externalTrafficInformEnableDesc' },
          { key: 'externalTrafficInformURI', kind: 'text', label: 'pages.settings.externalTrafficInformURI', hint: 'pages.settings.externalTrafficInformURIDesc' },
        ],
      },
      {
        title: 'pages.settings.dateAndTime',
        fields: [
          { key: 'timeLocation', kind: 'text', label: 'pages.settings.timeZone', hint: 'pages.settings.timeZoneDesc' },
          { key: 'datepicker', kind: 'select', label: 'pages.settings.datepicker', hint: 'pages.settings.datepickerDescription', options: ['gregorian', 'jalalian'] },
        ],
      },
      {
        prefix: 'LDAP',
        fields: [
          { key: 'ldapEnable', kind: 'bool', label: 'pages.settings.ldap.enable' },
          { key: 'ldapHost', kind: 'text', label: 'pages.settings.ldap.host' },
          { key: 'ldapPort', kind: 'number', label: 'pages.settings.ldap.port' },
          { key: 'ldapUseTLS', kind: 'bool', label: 'pages.settings.ldap.useTls' },
          { key: 'ldapInsecureSkipVerify', kind: 'bool', label: 'pages.settings.ldap.skipTlsVerify', hint: 'pages.settings.ldap.skipTlsVerifyDesc' },
          { key: 'ldapBindDN', kind: 'text', label: 'pages.settings.ldap.bindDn' },
          { key: 'ldapPassword', kind: 'secret', label: 'password' },
          { key: 'ldapBaseDN', kind: 'text', label: 'pages.settings.ldap.baseDn' },
          { key: 'ldapUserFilter', kind: 'text', label: 'pages.settings.ldap.userFilter' },
          { key: 'ldapUserAttr', kind: 'text', label: 'pages.settings.ldap.userAttr' },
          { key: 'ldapVlessField', kind: 'text', label: 'pages.settings.ldap.vlessField' },
          { key: 'ldapFlagField', kind: 'text', label: 'pages.settings.ldap.flagField', hint: 'pages.settings.ldap.flagFieldDesc' },
          { key: 'ldapTruthyValues', kind: 'text', label: 'pages.settings.ldap.truthyValues', hint: 'pages.settings.ldap.truthyValuesDesc' },
          { key: 'ldapInvertFlag', kind: 'bool', label: 'pages.settings.ldap.invertFlag', hint: 'pages.settings.ldap.invertFlagDesc' },
          { key: 'ldapSyncCron', kind: 'text', label: 'pages.settings.ldap.syncSchedule', hint: 'pages.settings.ldap.syncScheduleDesc' },
          { key: 'ldapAutoCreate', kind: 'bool', label: 'pages.settings.ldap.autoCreate' },
          { key: 'ldapAutoDelete', kind: 'bool', label: 'pages.settings.ldap.autoDelete' },
          { key: 'ldapDefaultTotalGB', kind: 'number', label: 'pages.settings.ldap.defaultTotalGb' },
          { key: 'ldapDefaultExpiryDays', kind: 'number', label: 'pages.settings.ldap.defaultExpiryDays' },
          { key: 'ldapDefaultLimitIP', kind: 'number', label: 'pages.settings.ldap.defaultIpLimit' },
          { key: 'ldapInboundTags', kind: 'text', label: 'pages.settings.ldap.inboundTags', hint: 'pages.settings.ldap.inboundTagsDesc' },
        ],
      },
      {
        title: 'pages.settings.customCss.tab',
        fields: [
          { key: 'customCss', kind: 'multiline', label: 'pages.settings.customCss.panel', hint: 'pages.settings.customCss.panelDesc' },
          { key: 'customLoginCss', kind: 'multiline', label: 'pages.settings.customCss.login', hint: 'pages.settings.customCss.loginDesc' },
        ],
      },
    ],
  },
  {
    id: 'telegram',
    title: 'pages.settings.TGBotSettings',
    sections: [
      {
        title: 'pages.settings.panelSettings',
        fields: [
          { key: 'tgBotEnable', kind: 'bool', label: 'pages.settings.telegramBotEnable', hint: 'pages.settings.telegramBotEnableDesc' },
          { key: 'tgBotToken', kind: 'secret', label: 'pages.settings.telegramToken' },
          { key: 'tgBotChatId', kind: 'text', label: 'pages.settings.telegramChatId', hint: 'pages.settings.telegramChatIdDesc' },
          { key: 'tgLang', kind: 'language', label: 'pages.settings.telegramBotLanguage' },
          { key: 'tgBotAPIServer', kind: 'text', label: 'pages.settings.telegramAPIServer', hint: 'pages.settings.telegramAPIServerDesc' },
          { key: 'tgBotProxy', kind: 'text', label: 'pages.settings.telegramProxy', hint: 'pages.settings.telegramProxyDesc' },
        ],
      },
      {
        title: 'pages.settings.notifications',
        fields: [
          { key: 'tgRunTime', kind: 'text', label: 'pages.settings.telegramNotifyTime', hint: 'pages.settings.telegramNotifyTimeDesc' },
          { key: 'tgBotBackup', kind: 'bool', label: 'pages.settings.tgNotifyBackup', hint: 'pages.settings.tgNotifyBackupDesc' },
          { key: 'tgEnabledEvents', kind: 'events', label: 'pages.settings.notifications', events: ['outbound.down', 'outbound.up', 'xray.crash', 'node.down', 'node.up', 'cpu.high', 'memory.high', 'login.attempt'] },
          { key: 'outboundDownThreshold', kind: 'number', label: 'pages.settings.eventOutboundDown' },
          { key: 'tgCpu', kind: 'number', label: 'pages.settings.eventCPUHigh', suffix: '%' },
          { key: 'tgMemory', kind: 'number', label: 'pages.settings.eventMemoryHigh', suffix: '%' },
        ],
      },
    ],
  },
  {
    id: 'email',
    title: 'pages.settings.emailSettings',
    sections: [
      {
        title: 'pages.settings.smtpSettings',
        fields: [
          { key: 'smtpEnable', kind: 'bool', label: 'pages.settings.smtpEnable', hint: 'pages.settings.smtpEnableDesc' },
          { key: 'smtpHost', kind: 'text', label: 'pages.settings.smtpHost', hint: 'pages.settings.smtpHostDesc' },
          { key: 'smtpPort', kind: 'number', label: 'pages.settings.smtpPort', hint: 'pages.settings.smtpPortDesc' },
          { key: 'smtpUsername', kind: 'text', label: 'pages.settings.smtpUsername', hint: 'pages.settings.smtpUsernameDesc' },
          { key: 'smtpPassword', kind: 'secret', label: 'pages.settings.smtpPassword' },
          { key: 'smtpFrom', kind: 'text', label: 'pages.settings.smtpFrom', hint: 'pages.settings.smtpFromDesc' },
          { key: 'smtpFromName', kind: 'text', label: 'pages.settings.smtpFromName', hint: 'pages.settings.smtpFromNameDesc' },
          { key: 'smtpTo', kind: 'text', label: 'pages.settings.smtpTo', hint: 'pages.settings.smtpToDesc' },
          { key: 'smtpEncryptionType', kind: 'select', label: 'pages.settings.smtpEncryption', hint: 'pages.settings.smtpEncryptionDesc', options: ['none', 'starttls', 'tls'] },
        ],
      },
      {
        title: 'pages.settings.notifications',
        fields: [
          { key: 'smtpEnabledEvents', kind: 'events', label: 'pages.settings.notifications', events: ['outbound.down', 'outbound.up', 'xray.crash', 'node.down', 'node.up', 'cpu.high', 'memory.high', 'login.attempt'] },
          { key: 'smtpCpu', kind: 'number', label: 'pages.settings.eventCPUHigh', suffix: '%' },
          { key: 'smtpMemory', kind: 'number', label: 'pages.settings.eventMemoryHigh', suffix: '%' },
        ],
      },
    ],
  },
  {
    id: 'discord',
    title: 'pages.settings.discordSettings',
    sections: [
      {
        title: 'pages.settings.panelSettings',
        fields: [
          { key: 'discordBotEnable', kind: 'bool', label: 'pages.settings.discordBotEnable', hint: 'pages.settings.discordBotEnableDesc' },
          { key: 'discordBotToken', kind: 'secret', label: 'pages.settings.discordBotToken' },
          { key: 'discordChannelId', kind: 'text', label: 'pages.settings.discordChannelId', hint: 'pages.settings.discordChannelIdDesc' },
          { key: 'discordAdminIds', kind: 'text', label: 'pages.settings.discordAdminIds', hint: 'pages.settings.discordAdminIdsDesc' },
          { key: 'discordLang', kind: 'language', label: 'pages.settings.discordBotLanguage' },
        ],
      },
      {
        title: 'pages.settings.notifications',
        fields: [
          { key: 'discordRunTime', kind: 'text', label: 'pages.settings.discordNotifyTime', hint: 'pages.settings.discordNotifyTimeDesc' },
          { key: 'discordBotBackup', kind: 'bool', label: 'pages.settings.discordNotifyBackup', hint: 'pages.settings.discordNotifyBackupDesc' },
          { key: 'discordEnabledEvents', kind: 'events', label: 'pages.settings.notifications', events: ['outbound.down', 'outbound.up', 'xray.crash', 'node.down', 'node.up', 'cpu.high', 'memory.high', 'login.attempt'] },
          { key: 'discordCpu', kind: 'number', label: 'pages.settings.eventCPUHigh', suffix: '%' },
          { key: 'discordMemory', kind: 'number', label: 'pages.settings.eventMemoryHigh', suffix: '%' },
        ],
      },
    ],
  },
  {
    id: 'subscription',
    title: 'pages.settings.subSettings',
    sections: [
      {
        title: 'pages.settings.panelSettings',
        fields: [
          { key: 'subEnable', kind: 'bool', label: 'pages.settings.subEnable', hint: 'pages.settings.subEnableDesc' },
          { key: 'subJsonEnable', kind: 'bool', label: 'pages.settings.subJsonEnableTitle', hint: 'pages.settings.subJsonEnable' },
          { key: 'subClashEnable', kind: 'bool', label: 'pages.settings.subClashEnableTitle' },
          { key: 'subListen', kind: 'text', label: 'pages.settings.subListen', hint: 'pages.settings.subListenDesc' },
          { key: 'subDomain', kind: 'text', label: 'pages.settings.subDomain', hint: 'pages.settings.subDomainDesc' },
          { key: 'subPort', kind: 'number', label: 'pages.settings.subPort', hint: 'pages.settings.subPortDesc' },
          { key: 'subPath', kind: 'text', label: 'pages.settings.subPath', hint: 'pages.settings.subPathDesc' },
          { key: 'subURI', kind: 'text', label: 'pages.settings.subURI', hint: 'pages.settings.subURIDesc' },
        ],
      },
      {
        title: 'pages.settings.information',
        fields: [
          { key: 'subEncrypt', kind: 'bool', label: 'pages.settings.subEncrypt', hint: 'pages.settings.subEncryptDesc' },
          { key: 'remarkTemplate', kind: 'text', label: 'pages.settings.remarkTemplate', hint: 'pages.settings.remarkTemplateDesc' },
          { key: 'subShowIdentityOnAllLinks', kind: 'bool', label: 'pages.settings.subShowIdentityOnAllLinks', hint: 'pages.settings.subShowIdentityOnAllLinksDesc' },
          { key: 'subInfoNodeEnable', kind: 'bool', label: 'pages.settings.subInfoNodeEnable', hint: 'pages.settings.subInfoNodeEnableDesc' },
          { key: 'subCalendarExpireInclusive', kind: 'bool', label: 'pages.settings.subCalendarExpireInclusive', hint: 'pages.settings.subCalendarExpireInclusiveDesc' },
          { key: 'subExpiredTemplate', kind: 'text', label: 'pages.settings.subExpiredTemplate', hint: 'pages.settings.subExpiredTemplateDesc' },
          { key: 'subTrafficDepletedTemplate', kind: 'text', label: 'pages.settings.subTrafficDepletedTemplate', hint: 'pages.settings.subTrafficDepletedTemplateDesc' },
          { key: 'subUpdates', kind: 'number', label: 'pages.settings.subUpdates', hint: 'pages.settings.subUpdatesDesc' },
          { key: 'externalSubUserAgent', kind: 'text', label: 'pages.settings.externalSubUserAgent', hint: 'pages.settings.externalSubUserAgentDesc' },
        ],
      },
      {
        title: 'pages.settings.profile',
        fields: [
          { key: 'subTitle', kind: 'text', label: 'pages.settings.subTitle', hint: 'pages.settings.subTitleDesc' },
          { key: 'subSupportUrl', kind: 'text', label: 'pages.settings.subSupportUrl', hint: 'pages.settings.subSupportUrlDesc' },
          { key: 'subProfileMode', kind: 'select', label: 'pages.settings.subProfileMode', hint: 'pages.settings.subProfileModeDesc', options: ['none', 'builtin', 'custom'] },
          { key: 'subProfileUrl', kind: 'text', label: 'pages.settings.subProfileUrl', hint: 'pages.settings.subProfileUrlDesc' },
          { key: 'subAnnounce', kind: 'text', label: 'pages.settings.subAnnounce', hint: 'pages.settings.subAnnounceDesc' },
          { key: 'subThemeDir', kind: 'text', label: 'pages.settings.subThemeDir' },
        ],
      },
      {
        title: 'pages.settings.certs',
        fields: [
          { key: 'subCertFile', kind: 'text', label: 'pages.settings.subCertPath', hint: 'pages.settings.subCertPathDesc' },
          { key: 'subKeyFile', kind: 'text', label: 'pages.settings.subKeyPath', hint: 'pages.settings.subKeyPathDesc' },
        ],
      },
      {
        prefix: 'Clash / Mihomo',
        fields: [
          { key: 'subClashEnableRouting', kind: 'bool', label: 'pages.settings.subClashEnableRouting', hint: 'pages.settings.subClashEnableRoutingDesc' },
          { key: 'subClashRules', kind: 'multiline', label: 'pages.settings.subClashRoutingRules', hint: 'pages.settings.subClashRoutingRulesDesc' },
        ],
      },
      {
        prefix: 'Happ',
        fields: [
          { key: 'subHappAutoDetect', kind: 'bool', label: 'pages.settings.subHappAutoDetect', hint: 'pages.settings.subHappAutoDetectDesc' },
          { key: 'happLinkEnable', kind: 'bool', label: 'pages.settings.happLinkEnable', hint: 'pages.settings.happLinkEnableDesc' },
        ],
      },
      {
        prefix: 'Happ · ',
        title: 'pages.settings.subHappGroupRouting',
        fields: [
          { key: 'subEnableRouting', kind: 'bool', label: 'pages.settings.subEnableRouting', hint: 'pages.settings.subEnableRoutingDesc' },
          { key: 'subRoutingRules', kind: 'multiline', label: 'pages.settings.subRoutingRules', hint: 'pages.settings.subRoutingRulesDesc' },
          { key: 'subHappNoLimit', kind: 'bool', label: 'pages.settings.subHappNoLimit', hint: 'pages.settings.subHappNoLimitDesc' },
          { key: 'subHideSettings', kind: 'bool', label: 'pages.settings.subHideSettings', hint: 'pages.settings.subHideSettingsDesc' },
        ],
      },
      {
        prefix: 'Happ · ',
        title: 'pages.settings.subHappGroupThemes',
        fields: [
          { key: 'subHappSubInfoText', kind: 'text', label: 'pages.settings.subHappSubInfoText', hint: 'pages.settings.subHappSubInfoTextDesc' },
          { key: 'subHappSubInfoColor', kind: 'select', label: 'pages.settings.subHappSubInfoColor', hint: 'pages.settings.subHappSubInfoColorDesc', options: ['blue', 'green', 'red'] },
          { key: 'subHappSubInfoButtonText', kind: 'text', label: 'pages.settings.subHappSubInfoButtonText', hint: 'pages.settings.subHappSubInfoButtonTextDesc' },
          { key: 'subHappSubInfoButtonLink', kind: 'text', label: 'pages.settings.subHappSubInfoButtonLink', hint: 'pages.settings.subHappSubInfoButtonLinkDesc' },
          { key: 'subHappSubExpire', kind: 'bool', label: 'pages.settings.subHappSubExpire', hint: 'pages.settings.subHappSubExpireDesc' },
          { key: 'subHappSubExpireButtonLink', kind: 'text', label: 'pages.settings.subHappSubExpireButtonLink', hint: 'pages.settings.subHappSubExpireButtonLinkDesc' },
          { key: 'subHappNotificationExpire', kind: 'bool', label: 'pages.settings.subHappNotificationExpire', hint: 'pages.settings.subHappNotificationExpireDesc' },
          { key: 'subHappColorProfile', kind: 'text', label: 'pages.settings.subHappColorProfile', hint: 'pages.settings.subHappColorProfileDesc' },
        ],
      },
      {
        prefix: 'Happ · ',
        title: 'pages.settings.subHappGroupNetwork',
        fields: [
          { key: 'subHappTunMode', kind: 'select', label: 'pages.settings.subHappTunMode', hint: 'pages.settings.subHappTunModeDesc', options: ['', 'system', 'gvisor'] },
          { key: 'subHappTunType', kind: 'select', label: 'pages.settings.subHappTunType', hint: 'pages.settings.subHappTunTypeDesc', options: ['singbox', 'tun2proxy', 'default', 'xray'] },
          { key: 'subHappExcludeRoutes', kind: 'text', label: 'pages.settings.subHappExcludeRoutes', hint: 'pages.settings.subHappExcludeRoutesDesc' },
          { key: 'subHappExcludeApns', kind: 'bool', label: 'pages.settings.subHappExcludeApns', hint: 'pages.settings.subHappExcludeApnsDesc' },
          { key: 'subHappPingType', kind: 'select', label: 'pages.settings.subHappPingType', hint: 'pages.settings.subHappPingTypeDesc', options: ['proxy', 'proxy-head', 'tcp', 'icmp'] },
          { key: 'subHappLocalProxyAuth', kind: 'select', label: 'pages.settings.subHappLocalProxyAuth', hint: 'pages.settings.subHappLocalProxyAuthDesc', options: ['auto', 'disable', ''] },
          { key: 'subHappAutoConnect', kind: 'bool', label: 'pages.settings.subHappAutoConnect', hint: 'pages.settings.subHappAutoConnectDesc' },
          { key: 'subHappAutoConnectType', kind: 'select', label: 'pages.settings.subHappAutoConnectType', hint: 'pages.settings.subHappAutoConnectTypeDesc', options: ['lowestdelay', 'lastused', 'random'] },
          { key: 'subHappPerAppMode', kind: 'select', label: 'pages.settings.subHappPerAppMode', hint: 'pages.settings.subHappPerAppModeDesc', options: ['off', 'on', 'bypass'] },
          { key: 'subHappPerAppList', kind: 'multiline', label: 'pages.settings.subHappPerAppList', hint: 'pages.settings.subHappPerAppListDesc' },
        ],
      },
      {
        prefix: 'Happ · ',
        title: 'pages.settings.subHappGroupFailover',
        fields: [
          { key: 'subHappProviderId', kind: 'text', label: 'pages.settings.subHappProviderId', hint: 'pages.settings.subHappProviderIdDesc' },
          { key: 'subHappNewUrl', kind: 'text', label: 'pages.settings.subHappNewUrl', hint: 'pages.settings.subHappNewUrlDesc' },
          { key: 'subHappFallbackUrl', kind: 'text', label: 'pages.settings.subHappFallbackUrl', hint: 'pages.settings.subHappFallbackUrlDesc' },
          { key: 'subHappAlwaysHwid', kind: 'bool', label: 'pages.settings.subHappAlwaysHwid', hint: 'pages.settings.subHappAlwaysHwidDesc' },
        ],
      },
      {
        prefix: 'Incy',
        fields: [
          { key: 'subIncyAppAutoDetect', kind: 'bool', label: 'pages.settings.subIncyAppAutoDetect', hint: 'pages.settings.subIncyAppAutoDetectDesc' },
        ],
      },
      {
        prefix: 'Incy · ',
        title: 'pages.settings.subIncyGroupApp',
        fields: [
          { key: 'subIncyProfileDescription', kind: 'text', label: 'pages.settings.subIncyProfileDescription', hint: 'pages.settings.subIncyProfileDescriptionDesc' },
          { key: 'subIncySortOrder', kind: 'select', label: 'pages.settings.subIncySortOrder', hint: 'pages.settings.subIncySortOrderDesc', options: ['', 'none', 'ping', 'name'] },
          { key: 'subIncySupportEmail', kind: 'text', label: 'pages.settings.subIncySupportEmail', hint: 'pages.settings.subIncySupportEmailDesc' },
          { key: 'subIncyAnnounceUrl', kind: 'text', label: 'pages.settings.subIncyAnnounceUrl', hint: 'pages.settings.subIncyAnnounceUrlDesc' },
          { key: 'subIncyPremiumUrl', kind: 'text', label: 'pages.settings.subIncyPremiumUrl', hint: 'pages.settings.subIncyPremiumUrlDesc' },
        ],
      },
      {
        prefix: 'Incy · ',
        title: 'pages.settings.subIncyGroupBanners',
        fields: [
          { key: 'subIncyBannerText', kind: 'text', label: 'pages.settings.subIncyBannerText', hint: 'pages.settings.subIncyBannerTextDesc' },
          { key: 'subIncyBannerButtonText', kind: 'text', label: 'pages.settings.subIncyBannerButtonText', hint: 'pages.settings.subIncyBannerButtonTextDesc' },
          { key: 'subIncyBannerButtonUrl', kind: 'text', label: 'pages.settings.subIncyBannerButtonUrl', hint: 'pages.settings.subIncyBannerButtonUrlDesc' },
          { key: 'subIncyBannerBgColor', kind: 'text', label: 'pages.settings.subIncyBannerBgColor', hint: 'pages.settings.subIncyBannerBgColorDesc' },
          { key: 'subIncyBannerButtonColor', kind: 'text', label: 'pages.settings.subIncyBannerButtonColor', hint: 'pages.settings.subIncyBannerButtonColorDesc' },
        ],
      },
      {
        prefix: 'Incy · ',
        title: 'pages.settings.subIncyGroupPrivacy',
        fields: [
          { key: 'subIncyHideUrl', kind: 'onoff', label: 'pages.settings.subIncyHideUrl', hint: 'pages.settings.subIncyHideUrlDesc' },
          { key: 'subIncyHideCheck', kind: 'onoff', label: 'pages.settings.subIncyHideCheck', hint: 'pages.settings.subIncyHideCheckDesc' },
          { key: 'subIncyNoLimitEnabled', kind: 'onoff', label: 'pages.settings.subIncyNoLimit', hint: 'pages.settings.subIncyNoLimitDesc' },
          { key: 'subIncyPerAppEnable', kind: 'onoff', label: 'pages.settings.subIncyPerAppEnable', hint: 'pages.settings.subIncyPerAppEnableDesc' },
          { key: 'subIncyPerAppMode', kind: 'select', label: 'pages.settings.subIncyPerAppMode', hint: 'pages.settings.subIncyPerAppModeDesc', options: ['', 'proxy', 'bypass'] },
          { key: 'subIncyPerAppList', kind: 'multiline', label: 'pages.settings.subIncyPerAppList', hint: 'pages.settings.subIncyPerAppListDesc' },
        ],
      },
      {
        prefix: 'Incy · ',
        title: 'pages.settings.subIncyGroupNetwork',
        fields: [
          { key: 'subIncyFragmentationEnable', kind: 'onoff', label: 'pages.settings.subIncyFragmentationEnable', hint: 'pages.settings.subIncyFragmentationEnableDesc' },
          { key: 'subIncyFragmentLength', kind: 'text', label: 'pages.settings.subIncyFragmentLength', hint: 'pages.settings.subIncyFragmentLengthDesc' },
          { key: 'subIncyFragmentInterval', kind: 'text', label: 'pages.settings.subIncyFragmentInterval', hint: 'pages.settings.subIncyFragmentIntervalDesc' },
          { key: 'subIncyFragmentPackets', kind: 'select', label: 'pages.settings.subIncyFragmentPackets', hint: 'pages.settings.subIncyFragmentPacketsDesc', options: ['', 'tlshello', '1-3', '1', 'all'] },
          { key: 'subIncyNoisesEnable', kind: 'onoff', label: 'pages.settings.subIncyNoisesEnable', hint: 'pages.settings.subIncyNoisesEnableDesc' },
          { key: 'subIncyNoisesType', kind: 'select', label: 'pages.settings.subIncyNoisesType', hint: 'pages.settings.subIncyNoisesTypeDesc', options: ['', 'rand', 'str', 'hex'] },
          { key: 'subIncyNoisesPacket', kind: 'text', label: 'pages.settings.subIncyNoisesPacket', hint: 'pages.settings.subIncyNoisesPacketDesc' },
          { key: 'subIncyNoisesDelay', kind: 'text', label: 'pages.settings.subIncyNoisesDelay', hint: 'pages.settings.subIncyNoisesDelayDesc' },
          { key: 'subIncyResolveEnable', kind: 'onoff', label: 'pages.settings.subIncyResolveEnable', hint: 'pages.settings.subIncyResolveEnableDesc' },
          { key: 'subIncyResolveDnsDomain', kind: 'text', label: 'pages.settings.subIncyResolveDnsDomain', hint: 'pages.settings.subIncyResolveDnsDomainDesc' },
          { key: 'subIncyResolveDnsIp', kind: 'text', label: 'pages.settings.subIncyResolveDnsIp', hint: 'pages.settings.subIncyResolveDnsIpDesc' },
        ],
      },
      {
        prefix: 'Incy · ',
        title: 'pages.settings.subIncyGroupRouting',
        fields: [
          { key: 'subIncyEnableRouting', kind: 'bool', label: 'pages.settings.subIncyEnableRouting', hint: 'pages.settings.subIncyEnableRoutingDesc' },
          { key: 'subIncyRoutingRules', kind: 'multiline', label: 'pages.settings.subIncyRoutingRules', hint: 'pages.settings.subIncyRoutingRulesDesc' },
        ],
      },
    ],
  },
  {
    id: 'subscription-formats',
    title: 'menu.subFormats',
    sections: [
      {
        prefix: 'JSON',
        fields: [
          { key: 'subJsonPath', kind: 'text', prefix: 'JSON ', label: 'pages.settings.subPath', hint: 'pages.settings.subPathDesc' },
          { key: 'subJsonURI', kind: 'text', prefix: 'JSON ', label: 'pages.settings.subURI', hint: 'pages.settings.subURIDesc' },
          { key: 'subJsonAlwaysArray', kind: 'bool', label: 'pages.settings.subJsonAlwaysArray', hint: 'pages.settings.subJsonAlwaysArrayDesc' },
          { key: 'subJsonAutoDetect', kind: 'bool', label: 'pages.settings.subJsonAutoDetect', hint: 'pages.settings.subJsonAutoDetectDesc' },
          { key: 'subJsonUserAgentRegex', kind: 'text', label: 'pages.settings.subJsonUserAgentRegex', hint: 'pages.settings.subJsonUserAgentRegexDesc' },
          { key: 'subJsonRoutingRules', kind: 'multiline', label: 'pages.settings.subJsonRoutingRules', hint: 'pages.settings.subJsonRoutingRulesDesc' },
          { key: 'subJsonDns', kind: 'multiline', label: 'pages.settings.subJsonDns', hint: 'pages.settings.subJsonDnsDesc' },
          { key: 'subJsonRules', kind: 'json', prefix: 'JSON rules' },
          { key: 'subJsonObservatory', kind: 'json', prefix: 'Observatory' },
        ],
      },
      {
        prefix: 'Clash',
        fields: [
          { key: 'subClashPath', kind: 'text', prefix: 'Clash ', label: 'pages.settings.subPath', hint: 'pages.settings.subPathDesc' },
          { key: 'subClashURI', kind: 'text', prefix: 'Clash ', label: 'pages.settings.subURI', hint: 'pages.settings.subURIDesc' },
          { key: 'subClashAutoDetect', kind: 'bool', label: 'pages.settings.subClashAutoDetect', hint: 'pages.settings.subClashAutoDetectDesc' },
          { key: 'subClashUserAgentRegex', kind: 'text', label: 'pages.settings.subClashUserAgentRegex', hint: 'pages.settings.subClashUserAgentRegexDesc' },
        ],
      },
      {
        title: 'pages.settings.subFormats.finalMask',
        fields: [
          { key: 'subJsonFinalMask', kind: 'json', label: 'pages.settings.subFormats.finalMask', hint: 'pages.settings.subFormats.finalMaskDesc' },
        ],
      },
      {
        title: 'pages.settings.mux',
        fields: [
          { key: 'subJsonMux', kind: 'json', label: 'pages.settings.mux', hint: 'pages.settings.muxDesc' },
        ],
      },
    ],
  },
];
