const {
      listProjects,
      listProjectsWithNodes,
      getProjectDetail,
      createProject,
      updateProject,
      deleteProject,
      getProjectNode,
      updateProjectNode,
      seedFromJsonFile,
      seedFromPayload,
} = require("../services/projectService");

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

      const { role, picName } = req.user || {};
      // Quản lý sửa mọi bước. PIC chỉ sửa bước có pic = tên mình. Viewer: cấm.
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
            if (!owner || owner !== (picName || "").trim()) {
                  return res.status(403).json({
                        error: "Bạn chỉ được sửa dòng việc được gán cho mình",
                  });
            }
      }

      const data = await updateProjectNode(projectId, nodeId, payload);
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
