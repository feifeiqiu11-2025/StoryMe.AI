/**
 * Project Service Tests
 * Tests for story project creation, scenes, and management
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ProjectService } from '@/lib/services/project.service';
import { createMockSupabaseClient, testData, expectToThrow } from '../utils/test-helpers';
import type { CreateProjectDTO } from '@/lib/domain/dtos';

describe('Project Service', () => {
  let projectService: ProjectService;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    projectService = new ProjectService(mockSupabase);
    jest.clearAllMocks();

    // Mock character exists check
    mockSupabase.from = jest.fn((table: string) => {
      if (table === 'character_library') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { ...testData.character, user_id: 'test-user-id' },
            error: null,
          }),
        };
      }
      if (table === 'projects') {
        return {
          insert: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: testData.project,
              error: null,
            }),
          })),
        };
      }
      if (table === 'project_characters') {
        return {
          insert: jest.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    });
  });

  describe('Create Project', () => {
    it('should successfully create a new project', async () => {
      const projectData: CreateProjectDTO = {
        title: 'Connor\'s Adventure',
        description: 'A magical story',
        originalScript: 'Connor playing with his friend at the park on a sunny day\nA big friendly dragon appears',
        characterIds: ['char-1'],
      };

      const project = await projectService.createProject('test-user-id', projectData);

      expect(project).toBeDefined();
      expect(project.title).toBe('Connor\'s Adventure');
      expect(project.status).toBe('draft');
    });

    it('should fail with script less than 10 characters', async () => {
      const projectData: CreateProjectDTO = {
        originalScript: 'Short',
        characterIds: ['char-1'],
      };

      await expectToThrow(
        async () => await projectService.createProject('test-user-id', projectData),
        'at least 10 characters'
      );
    });

    it('should fail with no characters', async () => {
      const projectData: CreateProjectDTO = {
        originalScript: 'A long enough script for the test',
        characterIds: [],
      };

      await expectToThrow(
        async () => await projectService.createProject('test-user-id', projectData),
        'At least one character'
      );
    });

    it('should fail with more than 5 characters', async () => {
      const projectData: CreateProjectDTO = {
        originalScript: 'A long enough script for the test',
        characterIds: ['char-1', 'char-2', 'char-3', 'char-4', 'char-5', 'char-6'],
      };

      await expectToThrow(
        async () => await projectService.createProject('test-user-id', projectData),
        'Maximum 5 characters'
      );
    });

    it('should link characters to project', async () => {
      const projectData: CreateProjectDTO = {
        title: 'Multi-character Story',
        originalScript: 'A story with multiple characters playing together',
        characterIds: ['char-1', 'char-2', 'char-3'],
      };

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'character_library') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { ...testData.character, user_id: 'test-user-id' },
              error: null,
            }),
          };
        }
        if (table === 'projects') {
          return {
            insert: jest.fn(() => ({
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { ...testData.project, id: 'project-1' },
                error: null,
              }),
            })),
          };
        }
        if (table === 'project_characters') {
          return {
            insert: jest.fn((data: any) => {
              expect(data).toHaveLength(3);
              expect(data[0].is_primary).toBe(true); // First character is primary
              expect(data[1].is_primary).toBe(false);
              return Promise.resolve({ error: null });
            }),
          };
        }
        return {};
      });

      await projectService.createProject('test-user-id', projectData);
    });

    it('should increment character usage count', async () => {
      const projectData: CreateProjectDTO = {
        originalScript: 'A story using this character',
        characterIds: ['char-1'],
      };

      mockSupabase.rpc = jest.fn().mockResolvedValue({ error: null });

      await projectService.createProject('test-user-id', projectData);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('increment_character_usage', {
        character_id: 'char-1',
      });
    });
  });

  describe('Save Scenes', () => {
    it('should save scenes for a project', async () => {
      const scenes = [
        {
          sceneNumber: 1,
          description: 'Connor playing at the park',
          characterIds: ['char-1'],
        },
        {
          sceneNumber: 2,
          description: 'A dragon appears',
          characterIds: ['char-1'],
        },
      ];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'projects') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: testData.project,
              error: null,
            }),
          };
        }
        if (table === 'scenes') {
          return {
            delete: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ error: null }),
            })),
            insert: jest.fn((data: any) => ({
              select: jest.fn().mockResolvedValue({
                data: data.map((scene: any, idx: number) => ({
                  id: `scene-${idx + 1}`,
                  ...scene,
                  created_at: new Date().toISOString(),
                })),
                error: null,
              }),
            })),
          };
        }
        return {};
      });

      const savedScenes = await projectService.saveScenes('project-1', scenes);

      expect(savedScenes).toHaveLength(2);
      expect(savedScenes[0].sceneNumber).toBe(1);
      expect(savedScenes[1].sceneNumber).toBe(2);
    });

    it('should fail for non-existent project', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'projects') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          };
        }
        return {};
      });

      await expectToThrow(
        async () => await projectService.saveScenes('non-existent-project', []),
        'Project not found'
      );
    });
  });

  describe('Get Project', () => {
    it('should get project by ID', async () => {
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: testData.project,
          error: null,
        }),
      }));

      const project = await projectService.getProject('project-1', 'test-user-id');

      expect(project).toBeDefined();
      expect(project?.id).toBe('project-1');
    });

    it('should fail if project belongs to different user', async () => {
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ...testData.project, user_id: 'different-user-id' },
          error: null,
        }),
      }));

      await expectToThrow(
        async () => await projectService.getProject('project-1', 'test-user-id'),
        'Unauthorized'
      );
    });

    it('should get project with characters', async () => {
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            ...testData.project,
            characters: [
              {
                id: 'pc-1',
                project_id: 'project-1',
                character_library_id: 'char-1',
                is_primary: true,
                character: testData.character,
              },
            ],
          },
          error: null,
        }),
      }));

      const project = await projectService.getProjectWithCharacters('project-1', 'test-user-id');

      expect(project).toBeDefined();
      expect(project?.characters).toHaveLength(1);
      expect(project?.characters[0].isPrimary).toBe(true);
    });

    it('should get project with scenes and images', async () => {
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            ...testData.project,
            scenes: [
              {
                ...testData.scene,
                images: [testData.generatedImage],
              },
            ],
          },
          error: null,
        }),
      }));

      const project = await projectService.getProjectWithScenes('project-1', 'test-user-id');

      expect(project).toBeDefined();
      expect(project?.scenes).toHaveLength(1);
      expect(project?.scenes[0].images).toHaveLength(1);
    });
  });

  describe('Get User Projects', () => {
    it('should get all projects for a user', async () => {
      const userProjects = [
        { ...testData.project, id: 'project-1', scenes: [] },
        { ...testData.project, id: 'project-2', scenes: [] },
      ];

      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: userProjects,
          error: null,
        }),
      }));

      const projects = await projectService.getUserProjects('test-user-id');

      expect(projects).toHaveLength(2);
      expect(projects[0].id).toBe('project-1');
      expect(projects[1].id).toBe('project-2');
    });
  });

  describe('Update Project', () => {
    it('should update project status', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'projects') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: testData.project,
              error: null,
            }),
            update: jest.fn(() => ({
              eq: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { ...testData.project, status: 'completed' },
                error: null,
              }),
            })),
          };
        }
        return {};
      });

      const updated = await projectService.updateProjectStatus(
        'project-1',
        'test-user-id',
        'completed'
      );

      expect(updated.status).toBe('completed');
    });
  });

  describe('Delete Project', () => {
    it('should delete project with cleanup', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'projects') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: testData.project,
              error: null,
            }),
            delete: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ error: null }),
            })),
          };
        }
        return {};
      });

      await projectService.deleteProject('project-1', 'test-user-id');

      // Should attempt to clean up storage
      expect(mockSupabase.storage.from).toHaveBeenCalled();
    });
  });

  describe('Project Statistics', () => {
    it('should get project stats for user', async () => {
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      }));

      // Mock count responses
      const mockCounts = {
        total: 10,
        drafts: 3,
        processing: 1,
        completed: 5,
        errors: 1,
      };

      let callCount = 0;
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn((callback: any) => {
          const counts = [
            mockCounts.total,
            mockCounts.drafts,
            mockCounts.processing,
            mockCounts.completed,
            mockCounts.errors,
          ];
          return Promise.resolve(callback({ count: counts[callCount++], error: null }));
        }),
      }));

      const stats = await projectService.getProjectStats('test-user-id');

      expect(stats.total).toBe(10);
      expect(stats.drafts).toBe(3);
      expect(stats.completed).toBe(5);
    });
  });
});
