// Bộ công cụ (function calling) cho chatbot. Mỗi tool gồm:
//  - declaration: mô tả cho Gemini
//  - execute(args, ctx): thực thi, ctx = { authed, email, picName }
// Tool ĐỌC: ai cũng gọi được. Tool GHI: chỉ PIC, và chỉ node có pic = tên mình.

const {
  listProjects,
  listProjectsWithNodes,
  getProjectDetail,
  getProjectNode,
  updateProjectNode,
} = require('../projectService');
const { WORKFLOW_NODES, NODE_INDEX } = require('../../constants/workflowNodes');
const { computeAllDates, lateDays, isoLocal } = require('../../utils/datePlanner');

const STATUS_OPTIONS = ['Chưa làm', 'Đang làm', 'Đã xong', 'Tạm dừng', 'Bỏ qua'];

// ---------- Helpers ----------

function norm(s) {
  return String(s || '').trim().toLowerCase();
}

// Tìm dự án theo id / code / tên (khớp gần đúng).
async function resolveProject(query) {
  const q = norm(query);
  const projects = await listProjects();
  if (!q) return { match: null, candidates: projects };

  // 1) id chính xác
  if (/^\d+$/.test(q)) {
    const byId = projects.find((p) => String(p.id) === q);
    if (byId) return { match: byId, candidates: [] };
  }
  // 2) code chính xác
  const byCode = projects.find((p) => norm(p.code) === q);
  if (byCode) return { match: byCode, candidates: [] };
  // 3) tên/ code chứa chuỗi
  const contains = projects.filter(
    (p) => norm(p.name).includes(q) || norm(p.code).includes(q),
  );
  if (contains.length === 1) return { match: contains[0], candidates: [] };
  return { match: null, candidates: contains.length ? contains : projects };
}

function summarizeNode(detail, node, dates) {
  const late = lateDays(detail, node.node_id, dates);
  const d = dates[node.node_id];
  return {
    code: node.node_id,
    name: node.node_name,
    stage: node.stage,
    status: node.status,
    pic: node.pic || '(chưa gán)',
    dept: node.dept || '',
    duration: node.duration,
    after: node.after || [],
    start: d ? isoLocal(d.start) : null,
    due: d ? isoLocal(d.due) : null,
    actual_date: node.actual_date || null,
    late_days: late,
    notes: node.notes || '',
  };
}

function candidateError(candidates) {
  return {
    error: 'Không xác định được 1 dự án duy nhất.',
    candidates: candidates.slice(0, 12).map((p) => ({ id: p.id, code: p.code, name: p.name })),
    hint: 'Hãy hỏi lại người dùng chọn đúng code/tên dự án.',
  };
}

// ---------- Tools ----------

const tools = {
  list_projects: {
    declaration: {
      name: 'list_projects',
      description: 'Liệt kê tất cả dự án (id, code, tên, loại, nhóm, chủ dự án, ngày bắt đầu).',
      parameters: { type: 'OBJECT', properties: {} },
    },
    async execute() {
      const projects = await listProjects();
      return { count: projects.length, projects };
    },
  },

  get_project: {
    declaration: {
      name: 'get_project',
      description:
        'Lấy chi tiết 1 dự án và toàn bộ các bước (node): trạng thái, PIC, phòng ban, ngày bắt đầu/hạn dự kiến (đã trừ T7/CN + lễ VN), số ngày trễ, ghi chú.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'id, code hoặc tên dự án' },
        },
        required: ['query'],
      },
    },
    async execute({ query }) {
      const { match, candidates } = await resolveProject(query);
      if (!match) return candidateError(candidates);
      const detail = await getProjectDetail(match.id);
      const dates = computeAllDates(detail);
      return {
        project: detail.project,
        nodes: detail.nodes.map((n) => summarizeNode(detail, n, dates)),
      };
    },
  },

  find_late_nodes: {
    declaration: {
      name: 'find_late_nodes',
      description:
        'Tìm các bước đang TRỄ hạn (quá due mà chưa xong). Không truyền query = quét toàn bộ dự án; có query = chỉ 1 dự án.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'id/code/tên dự án (tùy chọn)' },
        },
      },
    },
    async execute({ query } = {}) {
      let targets;
      if (query && norm(query)) {
        const { match, candidates } = await resolveProject(query);
        if (!match) return candidateError(candidates);
        const detail = await getProjectDetail(match.id);
        targets = [detail];
      } else {
        targets = await listProjectsWithNodes();
      }
      const out = [];
      for (const detail of targets) {
        const dates = computeAllDates(detail);
        for (const n of detail.nodes) {
          const late = lateDays(detail, n.node_id, dates);
          if (late > 0) {
            out.push({
              project_code: detail.project.code,
              project_name: detail.project.name,
              ...summarizeNode(detail, n, dates),
            });
          }
        }
      }
      out.sort((a, b) => b.late_days - a.late_days);
      return { count: out.length, late_nodes: out };
    },
  },

  list_nodes: {
    declaration: {
      name: 'list_nodes',
      description:
        'Lọc các bước của 1 dự án theo trạng thái / phòng ban / PIC. Dùng khi cần danh sách con của 1 dự án.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'id/code/tên dự án' },
          status: { type: 'STRING', description: 'lọc theo trạng thái (tùy chọn)' },
          dept: { type: 'STRING', description: 'lọc theo phòng ban (tùy chọn)' },
          pic: { type: 'STRING', description: 'lọc theo tên PIC (tùy chọn)' },
        },
        required: ['query'],
      },
    },
    async execute({ query, status, dept, pic }) {
      const { match, candidates } = await resolveProject(query);
      if (!match) return candidateError(candidates);
      const detail = await getProjectDetail(match.id);
      const dates = computeAllDates(detail);
      let nodes = detail.nodes;
      if (status) nodes = nodes.filter((n) => norm(n.status) === norm(status));
      if (dept) nodes = nodes.filter((n) => norm(n.dept) === norm(dept));
      if (pic) nodes = nodes.filter((n) => norm(n.pic).includes(norm(pic)));
      return {
        project: { id: match.id, code: match.code, name: match.name },
        count: nodes.length,
        nodes: nodes.map((n) => summarizeNode(detail, n, dates)),
      };
    },
  },

  projects_by_pic: {
    declaration: {
      name: 'projects_by_pic',
      description:
        'Tìm tất cả các bước đang được gán cho 1 người (PIC) trên mọi dự án. Kèm trạng thái và số ngày trễ.',
      parameters: {
        type: 'OBJECT',
        properties: {
          pic_name: { type: 'STRING', description: 'tên PIC cần tra' },
        },
        required: ['pic_name'],
      },
    },
    async execute({ pic_name }) {
      const all = await listProjectsWithNodes();
      const target = norm(pic_name);
      const out = [];
      for (const detail of all) {
        const dates = computeAllDates(detail);
        for (const n of detail.nodes) {
          if (norm(n.pic).includes(target) && target) {
            out.push({
              project_code: detail.project.code,
              project_name: detail.project.name,
              ...summarizeNode(detail, n, dates),
            });
          }
        }
      }
      return { pic: pic_name, count: out.length, nodes: out };
    },
  },

  explain_workflow: {
    declaration: {
      name: 'explain_workflow',
      description:
        'Giải thích quy trình chuẩn 27 bước (A→G). Truyền node_code để mô tả 1 bước cụ thể + bước phụ thuộc; bỏ trống để lấy toàn bộ danh sách.',
      parameters: {
        type: 'OBJECT',
        properties: {
          node_code: { type: 'STRING', description: 'mã bước ví dụ B5 (tùy chọn)' },
        },
      },
    },
    async execute({ node_code } = {}) {
      if (node_code) {
        const code = String(node_code).trim().toUpperCase();
        const node = NODE_INDEX[code];
        if (!node) return { error: `Không có bước ${code}` };
        const dependents = WORKFLOW_NODES.filter((n) => (n.defaultAfter || []).includes(code)).map(
          (n) => n.code,
        );
        return {
          node: {
            code: node.code,
            stage: node.stage,
            name: node.name,
            dept: node.dept,
            default_duration_days: node.defaultDuration,
            depends_on: node.defaultAfter,
            blocks: dependents,
          },
        };
      }
      return {
        total: WORKFLOW_NODES.length,
        nodes: WORKFLOW_NODES.map((n) => ({
          code: n.code,
          stage: n.stage,
          name: n.name,
          dept: n.dept,
          default_duration_days: n.defaultDuration,
          depends_on: n.defaultAfter,
        })),
      };
    },
  },

  whoami: {
    declaration: {
      name: 'whoami',
      description:
        'Cho biết người đang chat là ai và có quyền ghi không (dựa trên email Lark đối chiếu pic_members).',
      parameters: { type: 'OBJECT', properties: {} },
    },
    async execute(_args, ctx) {
      return {
        email: ctx.email || null,
        is_pic: !!ctx.authed,
        pic_name: ctx.picName || null,
        can_edit: ctx.authed
          ? 'Chỉ được sửa các bước có PIC = tên bạn.'
          : 'Chỉ xem. Email Lark của bạn chưa nằm trong danh sách PIC.',
      };
    },
  },

  update_node: {
    declaration: {
      name: 'update_node',
      description:
        'CẬP NHẬT 1 bước của dự án (chỉ PIC phụ trách bước đó). Có thể đổi status, actual_date (YYYY-MM-DD), notes, duration. LUÔN xác nhận lại với người dùng trước khi ghi.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'id/code/tên dự án' },
          node_code: { type: 'STRING', description: 'mã bước, ví dụ B5' },
          status: {
            type: 'STRING',
            description: `trạng thái mới: ${STATUS_OPTIONS.join(' | ')}`,
          },
          actual_date: { type: 'STRING', description: 'ngày hoàn thành thực tế YYYY-MM-DD' },
          notes: { type: 'STRING', description: 'ghi chú' },
          duration: { type: 'NUMBER', description: 'số ngày thực hiện' },
        },
        required: ['query', 'node_code'],
      },
    },
    async execute(args, ctx) {
      if (!ctx.authed) {
        return {
          error:
            'Bạn chưa được xác thực là PIC. Email Lark của bạn cần nằm trong bảng pic_members mới được sửa.',
        };
      }
      const { match, candidates } = await resolveProject(args.query);
      if (!match) return candidateError(candidates);

      const nodeCode = String(args.node_code || '').trim().toUpperCase();
      const node = await getProjectNode(match.id, nodeCode);
      if (!node) return { error: `Dự án ${match.code} không có bước ${nodeCode}.` };

      const owner = (node.pic || '').trim();
      if (!owner || owner !== (ctx.picName || '').trim()) {
        return {
          error: `Bước ${nodeCode} do "${owner || 'chưa gán'}" phụ trách, không phải bạn (${ctx.picName}). Bạn chỉ sửa được bước của mình.`,
        };
      }

      // Xây payload từ các field được cung cấp.
      const payload = {};
      if (args.status !== undefined) {
        if (!STATUS_OPTIONS.includes(args.status)) {
          return { error: `Trạng thái không hợp lệ. Chọn: ${STATUS_OPTIONS.join(', ')}` };
        }
        payload.status = args.status;
      }
      if (args.actual_date !== undefined) {
        if (args.actual_date && !/^\d{4}-\d{2}-\d{2}$/.test(args.actual_date)) {
          return { error: 'actual_date phải dạng YYYY-MM-DD.' };
        }
        payload.actual_date = args.actual_date || null;
      }
      if (args.notes !== undefined) payload.notes = args.notes;
      if (args.duration !== undefined) {
        const d = Number(args.duration);
        if (!Number.isFinite(d) || d < 0) return { error: 'duration phải là số >= 0.' };
        payload.duration = d;
      }
      if (Object.keys(payload).length === 0) {
        return { error: 'Không có gì để cập nhật.' };
      }

      const updated = await updateProjectNode(match.id, nodeCode, payload);
      return {
        ok: true,
        project: match.code,
        node: nodeCode,
        updated_fields: payload,
        result: {
          status: updated.status,
          actual_date: updated.actual_date,
          duration: updated.duration,
          notes: updated.notes,
        },
      };
    },
  },
};

function getDeclarations() {
  return Object.values(tools).map((t) => t.declaration);
}

async function executeTool(name, args, ctx) {
  const tool = tools[name];
  if (!tool) return { error: `Tool không tồn tại: ${name}` };
  try {
    return await tool.execute(args || {}, ctx || {});
  } catch (err) {
    return { error: `Lỗi khi chạy ${name}: ${err.message || String(err)}` };
  }
}

module.exports = { tools, getDeclarations, executeTool, STATUS_OPTIONS };
