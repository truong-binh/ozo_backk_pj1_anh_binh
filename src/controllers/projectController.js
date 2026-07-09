const {
      listProjects,
      listProjectsWithNodes,
      getProjectDetail,
      createProject,
      updateProject,
      deleteProject,
      getProjectNode,
      updateProjectNode,
      startReadySuccessors,
      seedFromJsonFile,
      seedFromPayload,
} = require("../services/projectService");
const { findMemberByName } = require("../services/picMembersService");
const {
      notifyAssignment,
      notifyNewProjectAssignments,
} = require("../services/reminders/reminderService");

async function getProjects(req, res) {
      const data = await listProjects();
      res.json(data);
}

async function getProjectById(req, res) {
      const projectId = Number(req.params.projectId);
      const data = await getProjectDetail(projectId);
      res.json(data);
}

async function getProjectsWithNodes(req, res) {
      const data = await listProjectsWithNodes();
      res.json(data);
}

async function postProject(req, res) {
      const { code, name, type, category, product_group, owner, start_date } =
            req.body || {};
      if (!code || !name || !type || !start_date) {
            return res
                  .status(400)
                  .json({ error: "code, name, type, start_date là bắt buộc" });
      }

      const created = await createProject({
            code,
            name,
            type,
            category: category || null,
            product_group: product_group || null,
            owner: owner || null,
            start_date,
      });

      // Tạo xong -> gửi tin GIAO VIỆC cho từng người phụ trách (nhãn "Trưởng phòng
      // X" quy về trưởng phòng thật). Chạy nền, không chặn phản hồi.
      notifyNewProjectAssignments(created.id).catch((e) =>
            console.error("[new-project-notify] lỗi:", e.message),
      );

      res.status(201).json(created);
}

async function patchProject(req, res) {
      const projectId = Number(req.params.projectId);
      const payload = req.body || {};
      const updated = await updateProject(projectId, payload);
      res.json(updated);
}

async function removeProject(req, res) {
      const projectId = Number(req.params.projectId);
      const result = await deleteProject(projectId);
      res.json(result);
}

async function patchProjectNode(req, res) {
      const projectId = Number(req.params.projectId);
      const nodeId = req.params.nodeId;
      const payload = req.body || {};

      const { role, picName, leadDepts } = req.user || {};
      // Quản lý sửa mọi bước. Trưởng phòng sửa mọi bước thuộc phòng mình quản lý.
      // PIC thường chỉ sửa bước có pic = tên mình. Viewer: cấm.
      if (role !== "manager") {
            if (role !== "PIC") {
                  return res
                        .status(403)
                        .json({ error: "Bạn không có quyền sửa" });
            }
            const node = await getProjectNode(projectId, nodeId);
            if (!node) {
                  return res.status(404).json({ error: "Không tìm thấy bước" });
            }
            const owner = (node.pic || "").trim();
            const nodeDept = (node.dept || "").trim();
            const isLeaderOfDept =
                  Array.isArray(leadDepts) && nodeDept && leadDepts.includes(nodeDept);
            const isOwner = owner && owner === (picName || "").trim();
            if (!isLeaderOfDept && !isOwner) {
                  return res.status(403).json({
                        error:
                              "Bạn chỉ được sửa bước của mình hoặc bước thuộc phòng bạn quản lý",
                  });
            }

            // PIC-chủ-bước (không phải trưởng phòng) muốn ĐỔI PIC -> chỉ được
            // chuyển cho người CÙNG PHÒNG với bước.
            if (payload.pic !== undefined && !isLeaderOfDept) {
                  const newPic = String(payload.pic || "").trim();
                  if (newPic && newPic !== owner) {
                        const target = await findMemberByName(newPic);
                        if (!target) {
                              return res.status(400).json({
                                    error: `Không tìm thấy PIC "${newPic}" trong danh bạ.`,
                              });
                        }
                        const targetDept = (target.dept || "").trim();
                        if (!nodeDept || targetDept !== nodeDept) {
                              return res.status(403).json({
                                    error: `Chỉ được chuyển cho PIC cùng phòng ${nodeDept || "—"}. "${target.pic_name}" thuộc phòng ${targetDept || "—"}.`,
                              });
                        }
                        payload.pic = target.pic_name; // chuẩn hoá tên theo danh bạ
                  }
            }
      }

      // Chuẩn hoá tên PIC về đúng danh bạ (vd "Ly" -> "Phạm Khánh Ly") để khớp
      // nhắc việc/báo cáo. Không tìm thấy -> giữ nguyên (cho phép người ngoài danh bạ).
      // Nhãn vai trò "Trưởng phòng ..." giữ nguyên, không dò danh bạ.
      if (payload.pic !== undefined && String(payload.pic).trim()) {
            const raw = String(payload.pic).trim();
            if (!raw.startsWith("Trưởng phòng ")) {
                  const canon = await findMemberByName(raw);
                  if (canon) payload.pic = canon.pic_name;
            }
      }

      // Tự động: điền NGÀY THỰC TẾ mà không nêu trạng thái -> coi như 'Đã xong'.
      if (payload.actual_date && payload.status === undefined) {
            payload.status = "Đã xong";
      }

      const data = await updateProjectNode(projectId, nodeId, payload);

      // Bước vừa 'Đã xong' hoặc 'Bỏ qua' -> mở khoá các bước kế tiếp đủ điều kiện sang 'Đang làm'.
      if (data.status === "Đã xong" || data.status === "Bỏ qua") {
            await startReadySuccessors(projectId, nodeId);
      }

      // Vừa phân/đổi PIC -> gửi ngay thông báo "việc mới được giao" cho PIC (Lark DM).
      // Chạy nền, không chặn phản hồi; dedupe & bỏ qua nhãn vai trò nằm trong service.
      if (payload.pic !== undefined) {
            notifyAssignment(projectId, nodeId).catch((e) =>
                  console.error("[assign-notify] lỗi:", e.message),
            );
      }

      res.json(data);
}

async function seedProjects(req, res) {
      const defaultPath = "o:/06-RnD/QuanLyDuAn/feelex-data.json";
      const targetPath =
            req.body?.jsonPath || process.env.SEED_JSON_PATH || defaultPath;
      const result = await seedFromJsonFile(targetPath);
      res.json({ ok: true, ...result });
}

async function seedProjectsFromPayload(req, res) {
      const payload = req.body || {};
      const projects = Array.isArray(payload.projects) ? payload.projects : [];
      const result = await seedFromPayload(projects);
      res.json({ ok: true, ...result });
}

module.exports = {
      getProjects,
      getProjectsWithNodes,
      getProjectById,
      postProject,
      patchProject,
      removeProject,
      patchProjectNode,
      seedProjects,
      seedProjectsFromPayload,
};
