const {
  listProjects,
  listProjectsWithNodes,
  getProjectDetail,
  createProject,
  updateProject,
  deleteProject,
  updateProjectNode,
  seedFromJsonFile,
  seedFromPayload,
} = require('../services/projectService');

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
  const { code, name, type, product_group, owner, start_date } = req.body || {};
  if (!code || !name || !type || !start_date) {
    return res
      .status(400)
      .json({ error: 'code, name, type, start_date là bắt buộc' });
  }

  const created = await createProject({
    code,
    name,
    type,
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
  const data = await updateProjectNode(projectId, nodeId, payload);
  res.json(data);
}

async function seedProjects(req, res) {
  const defaultPath = 'o:/06-RnD/QuanLyDuAn/feelex-data.json';
  const targetPath = req.body?.jsonPath || process.env.SEED_JSON_PATH || defaultPath;
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

