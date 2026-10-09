import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Checkbox, Form, Input, Modal, Radio, Select, Switch, message } from 'antd';

import { useNodesQuery } from '@/api/queries/useNodesQuery';
import { HttpUtil } from '@/utils';
import { getInboundClients } from '@/lib/xray/inbound-link';
import { inboundFromDb, type DbInboundLike } from '@/lib/xray/inbound-from-db';
import {
  buildChainRule,
  chainTagBase,
  outboundFromShareLink,
  shareLinkForNodeClient,
  uniqueOutboundTag,
  type ChainOutbound,
  type ChainRoutingRule,
  type ChainRulePosition,
} from './cross-server-chain';

interface MasterInbound extends DbInboundLike {
  id: number;
  nodeId?: number;
}

export interface CrossServerChainPreset {
  nodeId?: number;
  inboundId?: number;
}

interface CrossServerChainModalProps {
  open: boolean;
  preset?: CrossServerChainPreset;
  existingTags: string[];
  inboundTags: string[];
  onClose: () => void;
  onApply: (
    outbound: ChainOutbound,
    rule: ChainRoutingRule | null,
    position: ChainRulePosition,
  ) => void;
}

export default function CrossServerChainModal({
  open,
  preset,
  existingTags,
  inboundTags,
  onClose,
  onApply,
}: CrossServerChainModalProps) {
  const { t } = useTranslation();
  const [messageApi, messageContextHolder] = message.useMessage();
  const { nodes } = useNodesQuery();
  const directNodes = useMemo(() => nodes.filter((n) => !n.transitive), [nodes]);

  const [source, setSource] = useState<'node' | 'link'>('node');
  const [nodeId, setNodeId] = useState<number | undefined>(preset?.nodeId);
  const [inboundId, setInboundId] = useState<number | undefined>(preset?.inboundId);
  const [pickedEmail, setClientEmail] = useState<string | undefined>();
  const [link, setLink] = useState('');
  const [customTag, setTag] = useState<string | undefined>();
  const [inbounds, setInbounds] = useState<MasterInbound[]>([]);
  const [addRule, setAddRule] = useState(true);
  const [ruleInbounds, setRuleInbounds] = useState<string[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [ips, setIps] = useState<string[]>([]);
  const [allTraffic, setAllTraffic] = useState(false);
  const [position, setPosition] = useState<ChainRulePosition>('top');

  useEffect(() => {
    if (!open) return;
    HttpUtil.get<MasterInbound[]>('/panel/api/inbounds/list', undefined, { silent: true }).then(
      (msg) => setInbounds(msg?.success && Array.isArray(msg.obj) ? msg.obj : []),
    );
  }, [open]);

  const node = directNodes.find((n) => n.id === nodeId);
  const nodeInbounds = useMemo(
    () => inbounds.filter((ib) => nodeId != null && ib.nodeId === nodeId),
    [inbounds, nodeId],
  );
  const selectedInbound = nodeInbounds.find((ib) => ib.id === inboundId);
  const clientEmails = useMemo(() => {
    if (!selectedInbound) return [];
    const clients = getInboundClients(inboundFromDb(selectedInbound)) ?? [];
    return clients.map((c) => c.email).filter((e): e is string => !!e);
  }, [selectedInbound]);

  const clientEmail =
    pickedEmail && clientEmails.includes(pickedEmail) ? pickedEmail : clientEmails[0];
  const suggestedTag = useMemo(
    () =>
      uniqueOutboundTag(
        chainTagBase(source === 'node' ? (node?.name ?? '') : 'link'),
        existingTags,
      ),
    [source, node?.name, existingTags],
  );
  const tag = customTag ?? suggestedTag;

  function submit() {
    const trimmedTag = tag.trim();
    if (!trimmedTag || existingTags.includes(trimmedTag)) {
      messageApi.error(t('pages.xray.chain.tagTaken'));
      return;
    }
    const shareLink =
      source === 'link'
        ? link.trim()
        : node?.address && selectedInbound && clientEmail
          ? shareLinkForNodeClient({
              nodeAddress: node.address,
              inbound: selectedInbound,
              clientEmail,
            })
          : '';
    const outbound = shareLink ? outboundFromShareLink(shareLink, trimmedTag) : null;
    if (!outbound) {
      messageApi.error(t('pages.xray.chain.invalidSource'));
      return;
    }
    const rule = addRule
      ? buildChainRule({
          outboundTag: trimmedTag,
          inboundTags: ruleInbounds,
          domains,
          ips,
          allTraffic,
        })
      : null;
    if (addRule && !rule) {
      messageApi.warning(t('pages.xray.chain.noMatcher'));
      return;
    }
    onApply(outbound, rule, position);
  }

  return (
    <Modal
      open={open}
      title={t('pages.xray.chain.title')}
      okText={t('pages.xray.chain.apply')}
      cancelText={t('cancel')}
      onOk={submit}
      onCancel={onClose}
      destroyOnHidden
      width={640}
    >
      {messageContextHolder}
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        title={t('pages.xray.chain.intro')}
      />
      <Form layout="vertical">
        <Form.Item label={t('pages.xray.chain.source')}>
          <Radio.Group value={source} onChange={(e) => setSource(e.target.value)}>
            <Radio.Button value="node">{t('pages.xray.chain.sourceNode')}</Radio.Button>
            <Radio.Button value="link">{t('pages.xray.chain.sourceLink')}</Radio.Button>
          </Radio.Group>
        </Form.Item>
        {source === 'node' ? (
          <>
            <Form.Item label={t('pages.xray.chain.node')}>
              <Select
                value={nodeId}
                placeholder={t('pages.xray.chain.node')}
                options={directNodes.map((n) => ({
                  value: n.id,
                  label: `${n.name} (${n.address})`,
                }))}
                onChange={(v) => {
                  setNodeId(v);
                  setInboundId(undefined);
                }}
              />
            </Form.Item>
            <Form.Item
              label={t('pages.xray.chain.inbound')}
              extra={t('pages.xray.chain.inboundHint')}
            >
              <Select
                value={inboundId}
                disabled={!nodeId}
                options={nodeInbounds.map((ib) => ({
                  value: ib.id,
                  label: `${ib.remark || ib.tag} (${ib.protocol}:${ib.port})`,
                }))}
                onChange={setInboundId}
              />
            </Form.Item>
            <Form.Item label={t('pages.xray.chain.client')}>
              <Select
                value={clientEmail}
                disabled={!clientEmails.length}
                options={clientEmails.map((e) => ({ value: e, label: e }))}
                onChange={setClientEmail}
              />
            </Form.Item>
          </>
        ) : (
          <Form.Item label={t('pages.xray.chain.link')}>
            <Input.TextArea
              rows={3}
              value={link}
              placeholder="vless://... | vmess://... | trojan://... | ss://... | hysteria2://..."
              onChange={(e) => setLink(e.target.value)}
            />
          </Form.Item>
        )}
        <Form.Item label={t('pages.xray.chain.tag')}>
          <Input value={tag} onChange={(e) => setTag(e.target.value)} />
        </Form.Item>
        <Form.Item label={t('pages.xray.chain.addRule')}>
          <Switch checked={addRule} onChange={setAddRule} />
        </Form.Item>
        {addRule && (
          <>
            <Form.Item label={t('pages.xray.chain.ruleInbounds')}>
              <Select
                mode="multiple"
                allowClear
                value={ruleInbounds}
                options={inboundTags.map((tg) => ({ value: tg, label: tg }))}
                onChange={setRuleInbounds}
              />
            </Form.Item>
            <Form.Item label={t('pages.xray.chain.ruleDomains')}>
              <Select
                mode="tags"
                value={domains}
                placeholder="geosite:netflix, domain:example.com"
                tokenSeparators={[',', ' ']}
                onChange={setDomains}
              />
            </Form.Item>
            <Form.Item label={t('pages.xray.chain.ruleIps')}>
              <Select
                mode="tags"
                value={ips}
                placeholder="geoip:us, 203.0.113.0/24"
                tokenSeparators={[',', ' ']}
                onChange={setIps}
              />
            </Form.Item>
            <Form.Item>
              <Checkbox checked={allTraffic} onChange={(e) => setAllTraffic(e.target.checked)}>
                {t('pages.xray.chain.allTraffic')}
              </Checkbox>
            </Form.Item>
            <Form.Item label={t('pages.xray.chain.position')}>
              <Radio.Group value={position} onChange={(e) => setPosition(e.target.value)}>
                <Radio.Button value="top">{t('pages.xray.chain.positionTop')}</Radio.Button>
                <Radio.Button value="bottom">{t('pages.xray.chain.positionBottom')}</Radio.Button>
              </Radio.Group>
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
}
