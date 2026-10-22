import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Alert, Spin, Tag, Typography } from 'antd';

import { keys } from '@/api/queryKeys';
import { PanelChangelogSchema, type PanelChangelog } from '@/generated/zod';
import { HttpUtil } from '@/utils';
import { parseMsg } from '@/utils/zodValidate';

const KIND_COLORS: Record<string, string> = {
  added: 'green',
  changed: 'blue',
  fixed: 'cyan',
  removed: 'default',
  breaking: 'red',
  known_issues: 'orange',
};

async function fetchChangelog(lang: string): Promise<PanelChangelog> {
  const msg = await HttpUtil.get('/panel/api/server/getChangelog', { lang }, { silent: true });
  if (!msg?.success) throw new Error(msg?.msg || 'changelog unavailable');
  const validated = parseMsg(msg, PanelChangelogSchema, 'server/getChangelog');
  if (!validated.obj) throw new Error('empty changelog');
  return validated.obj;
}

// Changelog bullets are Markdown with `code` and **bold** only.
export function renderInline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 1)
      return (
        <Typography.Text key={i} code>
          {part.slice(1, -1)}
        </Typography.Text>
      );
    if (part.startsWith('**') && part.endsWith('**') && part.length > 3)
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export default function PanelChangelog({ updateAvailable }: { updateAvailable: boolean }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const query = useQuery({
    queryKey: keys.server.changelog(lang),
    queryFn: () => fetchChangelog(lang),
    staleTime: 10 * 60_000,
    retry: false,
  });

  const title = updateAvailable
    ? t('pages.index.changelog.title')
    : t('pages.index.changelog.current');
  return (
    <section className="panel-changelog" aria-label={title}>
      <div className="panel-changelog-head">
        <Typography.Text strong>{title}</Typography.Text>
        {query.data?.url && (
          <Typography.Link href={query.data.url} target="_blank" rel="noreferrer">
            {t('pages.index.changelog.openFull')}
          </Typography.Link>
        )}
      </div>
      {query.isPending ? (
        <Spin size="small" />
      ) : query.isError ? (
        <Alert type="info" showIcon title={t('pages.index.changelog.failed')} />
      ) : query.data.releases.length === 0 ? (
        <Typography.Text type="secondary">{t('pages.index.changelog.empty')}</Typography.Text>
      ) : (
        <div className="panel-changelog-body">
          {query.data.releases.map((release) => (
            <article key={release.version} className="panel-changelog-release">
              <Typography.Title level={5}>
                {release.version}
                {release.date && (
                  <Typography.Text type="secondary" className="panel-changelog-date">
                    {release.date}
                  </Typography.Text>
                )}
              </Typography.Title>
              {release.note && (
                <Typography.Paragraph type="secondary">{release.note}</Typography.Paragraph>
              )}
              {release.sections.map((section) => (
                <div key={section.kind} className="panel-changelog-section">
                  <Tag color={KIND_COLORS[section.kind] ?? 'default'}>
                    {t(`pages.index.changelog.kinds.${section.kind}`)}
                  </Tag>
                  <ul>
                    {section.items.map((item, i) => (
                      <li key={i}>
                        {renderInline(item.text)}
                        {item.sub && (
                          <ul>
                            {item.sub.map((sub, j) => (
                              <li key={j}>{renderInline(sub)}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
