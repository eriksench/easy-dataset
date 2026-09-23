import { getProjectRoot } from '@/lib/db/base';
import { NextResponse } from 'next/server';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import { requireOwnedProject } from '@/lib/auth/project-access';

const execFileAsync = promisify(execFile);

/**
 * Open project directory
 * @returns {Promise<Response>} Operation result response
 */
export async function POST(request) {
  try {
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project ID is required'
        },
        { status: 400 }
      );
    }

    const access = await requireOwnedProject(request, projectId);
    if (access.response) return access.response;

    // Get project root directory
    const projectRoot = await getProjectRoot();
    const resolvedRoot = path.resolve(projectRoot);
    const projectPath = path.resolve(resolvedRoot, projectId);
    if (!projectPath.startsWith(`${resolvedRoot}${path.sep}`)) {
      return NextResponse.json({ error: 'Invalid project path' }, { status: 400 });
    }
    await fs.access(projectPath);

    // Open directory based on OS
    const platform = process.platform;
    let command;

    if (platform === 'win32') {
      // Windows
      command = 'explorer';
    } else if (platform === 'darwin') {
      // macOS
      command = 'open';
    } else {
      // Linux and others
      command = 'xdg-open';
    }

    await execFileAsync(command, [projectPath]);

    return NextResponse.json({
      success: true,
      message: 'Project directory opened'
    });
  } catch (error) {
    console.error('Failed to open project directory:', String(error));
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}
