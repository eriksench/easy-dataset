import { withProjectAccess } from '@/lib/auth/project-access';
// 获取项目详情
import { deleteProject, getProject, updateProject, getTaskConfig } from '@/lib/db/projects';

async function GETHandler(request, { params }) {
  try {
    const { projectId } = params;
    const project = await getProject(projectId);
    const taskConfig = await getTaskConfig(projectId);
    if (!project) {
      return Response.json({ error: '项目不存在' }, { status: 404 });
    }
    return Response.json({ ...project, taskConfig });
  } catch (error) {
    console.error('获取项目详情出错:', String(error));
    return Response.json({ error: String(error) }, { status: 500 });
  }
}

// 更新项目
async function PUTHandler(request, { params, currentUser }) {
  try {
    const { projectId } = params;
    const projectData = await request.json();

    const hasNameField = Object.prototype.hasOwnProperty.call(projectData, 'name');
    const hasDefaultModelField = Object.prototype.hasOwnProperty.call(projectData, 'defaultModelConfigId');

    // 至少允许更新名称或默认模型（defaultModelConfigId 可显式为 null）
    if (!hasNameField && !hasDefaultModelField) {
      return Response.json({ error: '项目名称不能为空' }, { status: 400 });
    }

    if (hasNameField && !projectData.name && !hasDefaultModelField) {
      return Response.json({ error: '项目名称不能为空' }, { status: 400 });
    }

    const allowedUpdates = {};
    if (hasNameField) allowedUpdates.name = projectData.name;
    if (hasDefaultModelField) allowedUpdates.defaultModelConfigId = projectData.defaultModelConfigId;

    const updatedProject = await updateProject(projectId, allowedUpdates, currentUser.userId);

    if (!updatedProject) {
      return Response.json({ error: '项目不存在' }, { status: 404 });
    }

    return Response.json(updatedProject);
  } catch (error) {
    console.error('更新项目出错:', String(error));
    return Response.json({ error: String(error) }, { status: 500 });
  }
}

// 删除项目
async function DELETEHandler(request, { params, currentUser }) {
  try {
    const { projectId } = params;
    const success = await deleteProject(projectId, currentUser.userId);

    if (!success) {
      return Response.json({ error: '项目不存在' }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('删除项目出错:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export const GET = withProjectAccess(GETHandler);
export const PUT = withProjectAccess(PUTHandler);
export const DELETE = withProjectAccess(DELETEHandler);
