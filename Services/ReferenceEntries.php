<?php

namespace Acms\Plugins\DF_FormGuard\Services;

class ReferenceEntries
{
    /**
     * @var DebugLogger
     */
    private $logger;

    public function __construct(DebugLogger $logger)
    {
        $this->logger = $logger;
    }

    /**
     * @param int[] $eids
     */
    public function buildContext(array $eids, int $maxChars): string
    {
        $eids = $this->normalizeEids($eids);
        if (empty($eids)) {
            return '';
        }

        $sql = \SQL::newSelect('entry');
        $sql->addSelect('entry_id');
        $sql->addSelect('entry_title');
        $sql->addSelect('entry_datetime');
        $sql->addSelect('fulltext_value', null, 'fulltext');
        $sql->addLeftJoin('fulltext', 'fulltext_eid', 'entry_id');
        $sql->addWhereIn('entry_id', $eids);
        $sql->addWhereOpr('entry_status', 'open');
        $sql->setFieldOrder('entry_id', $eids);

        $rows = \DB::query($sql->get(dsn()), 'all');
        if (empty($rows)) {
            $this->logger->info('reference entries empty', ['eids' => implode(',', $eids)]);
            return '';
        }

        $blocks = [];
        foreach ($rows as $row) {
            $title = $this->clean((string)($row['entry_title'] ?? ''));
            $body = $this->clean((string)($row['fulltext_value'] ?? ''));
            if ($title === '' && $body === '') {
                continue;
            }
            $blocks[] = sprintf(
                "EID:%d\nタイトル: %s\n本文: %s",
                (int)$row['entry_id'],
                $title,
                $body
            );
        }

        $text = implode("\n\n---\n\n", $blocks);
        if (mb_strlen($text) > $maxChars) {
            $text = mb_substr($text, 0, $maxChars) . "\n...(reference truncated)";
        }

        $this->logger->info('reference entries loaded', [
            'requested' => count($eids),
            'loaded' => count($blocks),
            'chars' => mb_strlen($text),
        ]);

        return $text;
    }

    /**
     * @param int[] $eids
     * @return int[]
     */
    private function normalizeEids(array $eids): array
    {
        $normalized = [];
        foreach ($eids as $eid) {
            $eid = (int)$eid;
            if ($eid > 0) {
                $normalized[$eid] = $eid;
            }
        }
        return array_values($normalized);
    }

    private function clean(string $text): string
    {
        $text = trim(strip_tags($text));
        $text = preg_replace('/\s+/u', ' ', $text);
        return trim((string)$text);
    }
}
