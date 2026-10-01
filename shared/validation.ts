// 导入包结构校验：前后端（页面 JSON 导入与 POST /api/validate）共用同一套规则。
// 仅做结构校验，不改动传入数据；任何不合格都收集为带结构位置与原因的错误项，
// 由调用方决定如何展示（页面弹窗逐条列出 / HTTP 400 返回首条原因）。
import type { ClauseDocument, NodeKind } from './model';

export interface NodeValidationIssue {
  /** 树内结构位置，如「document.root[0].children[1].children[0]」，空 root 时为 document */
  path: string;
  /** 不合格原因 */
  message: string;
}

export interface DocumentValidationResult {
  ok: boolean;
  /** 全部不合格原因（ok 时为空） */
  errors: NodeValidationIssue[];
  /** 条 / 款 / 项数量与节点总数（ok 时可用） */
  counts?: { articles: number; paragraphs: number; items: number; nodes: number };
}

const KINDS: readonly NodeKind[] = ['article', 'paragraph', 'item'];

function err(errors: NodeValidationIssue[], path: string, message: string): void {
  errors.push({ path, message });
}

function isPlainNode(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * 按 条 → 款 → 项 层级深度校验条款树：
 * - 层级类型：root 只允许条，条下只允许款，款下只允许项，项必须为叶子；
 * - 必需字段：每个节点必须为对象且具备字符串 id（非空）、合法 kind、字符串 text、数组 children；
 * - 全树 ID 唯一：任意两个节点（含嵌套款、项）共用同一 id 即不合格；
 * - 空 root（0 条）合法。
 * 校验只读遍历：缺少 children 的节点不会导致抛错，而是记录原因后停止下钻。
 */
export function validateClauseTree(root: unknown): DocumentValidationResult {
  const errors: NodeValidationIssue[] = [];
  const counts = { articles: 0, paragraphs: 0, items: 0, nodes: 0 };
  if (!Array.isArray(root)) {
    err(errors, 'document', 'document.root 必须是数组');
    return { ok: false, errors };
  }
  const seenIds = new Map<string, string>();

  /**
   * @param nodes 待校验的同层节点
   * @param parentPath 父级路径，如 document.root[0].children
   * @param expectedKind 该层允许的节点类型（条 / 款 / 项）
   * @param depth 0=条 1=款 2=项
   */
  const walkLevel = (nodes: unknown[], parentPath: string, depth: 0 | 1 | 2): void => {
    const expectedKind = KINDS[depth];
    nodes.forEach((rawNode, i) => {
      const nodePath = `${parentPath}[${i}]`;
      if (!isPlainNode(rawNode)) {
        err(errors, nodePath, `节点必须是对象，实际为 ${rawNode === null ? 'null' : typeof rawNode}`);
        return;
      }
      const node = rawNode as Record<string, unknown>;

      // 必需字段：id
      if (typeof node.id !== 'string' || node.id.length === 0) {
        err(errors, nodePath, '缺少必需字段 id（必须是非空字符串），节点 ID 是引用定位与审签关联的唯一键');
      } else {
        const firstPath = seenIds.get(node.id);
        if (firstPath) {
          err(errors, nodePath, `节点 ID「${node.id}」与 ${firstPath} 重复：全树 ID 必须唯一，重复 ID 会使分析索引覆盖前一节点、引用与审签关联错误`);
        } else {
          seenIds.set(node.id, nodePath);
        }
      }

      // 必需字段：kind（且必须符合所在层级 条 → 款 → 项）
      if (typeof node.kind !== 'string') {
        err(errors, nodePath, `缺少必需字段 kind（该层必须为「${expectedKind}」）`);
      } else if (!(KINDS as string[]).includes(node.kind)) {
        err(errors, nodePath, `节点 kind「${node.kind}」非法，仅支持 article / paragraph / item`);
      } else if (node.kind !== expectedKind) {
        err(
          errors,
          nodePath,
          `层级类型错误：${pathLabel(parentPath, i)}应为「${expectedKind}」，实际为「${node.kind}」（条 → 款 → 项不可错位）`,
        );
      } else if (node.kind === 'article') {
        counts.articles += 1;
      } else if (node.kind === 'paragraph') {
        counts.paragraphs += 1;
      } else {
        counts.items += 1;
      }
      counts.nodes += 1;

      // 必需字段：text（空正文允许为 ''，但字段必须存在且为字符串）
      if (typeof node.text !== 'string') {
        err(errors, nodePath, '缺少必需字段 text（必须是字符串；空正文可为空字符串 ""）');
      }
      if (node.title !== undefined && typeof node.title !== 'string') {
        err(errors, nodePath, '字段 title 必须是字符串（条标题）');
      }
      if (node.suffix !== undefined && typeof node.suffix !== 'string') {
        err(errors, nodePath, '字段 suffix 必须是字符串（条序号后缀，如「之一」）');
      }
      // ordinal 导入时按结构位置重排，缺省不拦截；存在但类型错误仍属坏数据
      if (node.ordinal !== undefined && typeof node.ordinal !== 'number') {
        err(errors, nodePath, '字段 ordinal 必须是数字（导入时会按结构位置重新编号）');
      }

      // 必需字段：children（必须是数组；缺失也明确说明原因，而不是在遍历时抛错）
      if (!Array.isArray(node.children)) {
        err(errors, nodePath, `缺少必需字段 children（必须是数组；${expectedKind === 'item' ? '项为叶子节点，应为 []' : '无下级节点时也应为 []'}）`);
        return;
      }

      // 层级约束：条下只允许款，款下只允许项，项必须为叶子
      if (depth === 0 || depth === 1) {
        walkLevel(node.children, `${nodePath}.children`, (depth + 1) as 1 | 2);
      } else {
        // 项为叶子：逐个标出其下非法挂载的节点（层级固定为项之下，期望仍是叶子）
        node.children.forEach((child, ci) => {
          const childPath = `${nodePath}.children[${ci}]`;
          if (!isPlainNode(child)) {
            err(errors, childPath, `节点必须是对象，实际为 ${child === null ? 'null' : typeof child}`);
            return;
          }
          const childKind = (child as Record<string, unknown>).kind;
          err(
            errors,
            childPath,
            `层级类型错误：项（item）为叶子节点，不能再包含下级节点${typeof childKind === 'string' ? `（发现 kind「${childKind}」）` : ''}`,
          );
        });
      }
    });
  };

  walkLevel(root, 'document.root', 0);
  return errors.length === 0
    ? { ok: true, errors: [], counts }
    : { ok: false, errors };
}

/** 由父级路径与下标拼出人类可读的结构位置，如「第 2 条第 1 款第 1 项」 */
function pathLabel(parentPath: string, index: number): string {
  const depth = (parentPath.match(/\.children/g) ?? []).length;
  const ordinal = index + 1;
  if (depth === 0) return `第 ${ordinal} 条`;
  if (depth === 1) return `该条第 ${ordinal} 款`;
  return `该款第 ${ordinal} 项`;
}

/**
 * 校验导出包 / 持久化形态中的文档对象：
 * 必须包含字符串 title 与条款树 root（结构规则同 validateClauseTree）。
 * 返回 counts 供 HTTP 接口的 rootCount 使用。
 */
export function validateDocument(document: unknown): DocumentValidationResult & {
  title?: string;
  rootCount?: number;
} {
  if (!isPlainNode(document)) {
    return {
      ok: false,
      errors: [{ path: 'document', message: '缺少 document：导入包必须包含 document 对象' }],
    };
  }
  const errors: NodeValidationIssue[] = [];
  if (typeof (document as Partial<ClauseDocument>).title !== 'string') {
    err(errors, 'document.title', 'document.title 必须是字符串');
  }
  const tree = validateClauseTree((document as Partial<ClauseDocument>).root);
  if (!tree.ok) errors.push(...tree.errors);
  if (errors.length > 0) return { ok: false, errors };
  const validDoc = document as unknown as ClauseDocument;
  return {
    ok: true,
    errors: [],
    counts: tree.counts,
    title: validDoc.title,
    rootCount: validDoc.root.length,
  };
}

/** 取首条错误的完整描述（路径 + 原因），供单行错误提示使用 */
export function firstErrorMessage(result: DocumentValidationResult): string {
  const first = result.errors[0];
  return first ? `${first.path}：${first.message}` : '文档结构不合法';
}
