import { createProject, getProjects, isExistByName } from '@/lib/db/projects';
import { createInitModelConfig, getModelConfigByProjectId } from '@/lib/db/model-config';
import {
  authenticationRequiredResponse,
  getCurrentUser,
  getOwnedProject,
  projectNotFoundResponse
} from '@/lib/auth/project-access';

export async function POST(request) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return authenticationRequiredResponse();

    const projectData = await request.json();
    if (!projectData.name) {
      return Response.json({ error: 'Project name is required' }, { status: 400 });
    }

    if (await isExistByName(projectData.name, currentUser.userId)) {
      return Response.json({ error: 'Project name already exists' }, { status: 400 });
    }
    let reusableConfig = [];
    if (projectData.reuseConfigFrom) {
      const sourceProject = await getOwnedProject(projectData.reuseConfigFrom, currentUser.userId, { id: true });
      if (!sourceProject) return projectNotFoundResponse();

      reusableConfig = await getModelConfigByProjectId(projectData.reuseConfigFrom);
    }

    const newProject = await createProject(projectData, currentUser.userId);
    if (reusableConfig.length > 0) {
      const newData = reusableConfig.map(item => {
        const { id, ...config } = item;
        return {
          ...config,
          projectId: newProject.id
        };
      });
      await createInitModelConfig(newData);
    }
    return Response.json(newProject, { status: 201 });
  } catch (error) {
    console.error('Failed to create project:', String(error));
    return Response.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return authenticationRequiredResponse();

    const projects = await getProjects(currentUser.userId);
    return Response.json(projects);
  } catch (error) {
    console.error('Failed to get project list:', String(error));
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
