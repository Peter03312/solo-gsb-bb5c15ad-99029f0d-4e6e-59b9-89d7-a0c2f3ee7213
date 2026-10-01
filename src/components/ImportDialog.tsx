import { useRef, useState } from 'react';
import { useApp } from '../lib/context';
import type { ExportBundle } from '../../shared/model';
import { validateDocument } from '../../shared/validation';
import { sampleDocument } from '../lib/sample';

const PASTE_PLACEHOLDER = `示例法（节选）

第一条【立法目的】
为了规范条款引用活动，制定本法。本法所称条款引用，适用第三条至第五条的规定。

第二条【适用范围】
本法适用于规范性文件的起草与审查。
具体程序依照前款规定执行：
（一）起草阶段应当标注全部交叉引用；
（二）发现引用错误的，按照第五条第二款第（一）项处理。

第三条【引用格式】
引用本条其他款的，可以简写为“本条第X款”；引用前一款的，可以简写为“前款”。`;

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const { store } = useApp();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** 结构化校验失败时逐条列出的位置与原因 */
  const [validationErrors, setValidationErrors] = useState<{ path: string; message: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const doPasteImport = () => {
    if (!text.trim()) {
      setError('请先粘贴条款文本');
      return;
    }
    store.importPastedText(text);
    onClose();
  };

  const onFile = async (file: File) => {
    setError(null);
    setValidationErrors([]);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch (e) {
      setError(`JSON 解析失败：${(e as Error).message}`);
      return;
    }
    // 与 POST /api/validate 同一套规则：条→款→项层级、必需字段、全树 ID 唯一性
    const bundle = parsed as Partial<ExportBundle>;
    if (!bundle || typeof bundle !== 'object' || !('document' in bundle)) {
      setError('JSON 结构不合法：缺少 document.root');
      return;
    }
    const result = validateDocument(bundle.document);
    if (!result.ok) {
      // 任一不合格即拒绝导入：当前正文、审阅留痕与撤销历史保持原状
      setError(`JSON 结构不合法，共 ${result.errors.length} 项问题，已取消导入（当前文档未改动）：`);
      setValidationErrors(result.errors);
      return;
    }
    const imported = store.importJson(bundle as ExportBundle);
    if (!imported.ok) {
      setError(`${imported.error}，已取消导入（当前文档未改动）`);
      setValidationErrors(imported.errors);
      return;
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="导入条款">
        <div className="modal-head">
          <h2>粘贴 / 导入条款</h2>
          <button className="close-x" onClick={onClose} aria-label="关闭">×</button>
        </div>

        <p className="modal-hint">
          粘贴含“第X条”“（一）”等编号的中文条款文本，系统会自动解析为
          <strong> 条 → 款 → 项 </strong>层级。空行用于分款，解析不会改写你的原文编号以外的内容。
        </p>
        <textarea
          className="paste-area"
          placeholder={PASTE_PLACEHOLDER}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {error && <div className="form-error">{error}</div>}
        {validationErrors.length > 0 && (
          <ul className="validation-error-list">
            {validationErrors.slice(0, 20).map((e, i) => (
              <li key={`${e.path}-${i}`}>
                <code>{e.path}</code>：{e.message}
              </li>
            ))}
            {validationErrors.length > 20 && <li>…另有 {validationErrors.length - 20} 项问题未列出</li>}
          </ul>
        )}

        <div className="modal-actions">
          <label className="file-btn">
            选择 JSON 文件
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                // 允许修正后再次选择同一个文件
                e.target.value = '';
                if (f) void onFile(f);
              }}
            />
          </label>
          <button className="link-btn" onClick={() => {
            store.replaceWithSample(sampleDocument());
            onClose();
          }}>
            载入内置示例
          </button>
          <div className="spacer" />
          <button onClick={onClose}>取消</button>
          <button className="primary" onClick={doPasteImport}>解析并替换当前文档</button>
        </div>
      </div>
    </div>
  );
}
