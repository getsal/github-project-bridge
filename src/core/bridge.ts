import { readFileSync } from "node:fs";
import { createGitHubClients, formatGitHubError, loadGitHubEnv, parseRepoRef } from "../github/client.js";
import { createIssue, commentIssue, findOpenIssueByExactTitle } from "../github/issues.js";
import { commentPullRequestConversation } from "../github/prs.js";
import {
  addIssueToProject,
  findFieldByName,
  findSingleSelectOption,
  getProjectByNumber,
  getProjectFields,
  getRepositoryNodeId,
  getViewerLogin,
  listProjectItems,
  setProjectFieldValue,
} from "../github/projects.js";
import type {
  CommentResult,
  GitHubEnv,
  GitHubRepoRef,
  ImportReport,
  ImportRowResult,
  IssueCreateResult,
  ProjectField,
  ProjectItemSummary,
  ProjectSummary,
} from "../types.js";

type CsvRow = Record<string, string>;

export interface ImportCsvOptions {
  dryRun?: boolean;
  limit?: number;
  skipExisting?: boolean;
}

export interface WhoAmIResult {
  login: string;
  repo: { id: string; nameWithOwner: string };
  project: ProjectSummary;
}

export interface ProjectListResult {
  project: ProjectSummary;
  items: ProjectItemSummary[];
}

function parseLabels(value?: string): string[] {
  return (value ?? "")
    .split(/[;,|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitCsvIntoRows(text: string): string[][] {
  const rowsRaw: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\r") {
      if (next === "\n") i += 1;
      row.push(cell);
      rowsRaw.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (char === "\n") {
      row.push(cell);
      rowsRaw.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell);
  rowsRaw.push(row);
  return rowsRaw.filter((currentRow) => currentRow.some((value) => value.trim().length > 0));
}

function parseCsv(text: string): CsvRow[] {
  const rows = splitCsvIntoRows(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) => {
    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
}

function getCell(row: CsvRow, candidates: string[]): string {
  for (const candidate of candidates) {
    const value = row[candidate];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

function getCellRaw(row: CsvRow, candidates: string[]): string {
  for (const candidate of candidates) {
    const value = row[candidate];
    if (value && value.length > 0) return value;
  }
  return "";
}

function buildIssueBody(metadata: { priority?: string; area?: string; agent?: string }): string {
  const priority = metadata.priority || "TBD";
  const area = metadata.area || "TBD";
  const agent = metadata.agent || "TBD";
  return [
    "## Goal",
    "Imported from Notion task list.",
    "",
    "## Scope",
    "TBD.",
    "",
    "## Acceptance Criteria",
    "- [ ] Task is implemented or resolved.",
    "- [ ] Related code/docs are updated.",
    "- [ ] Result is reviewed.",
    "",
    "## Metadata",
    `- Priority: ${priority}`,
    `- Area: ${area}`,
    `- Agent: ${agent}`,
    "- Source: Notion CSV import",
  ].join("\n");
}

function inferSingleSelectValue(field: ProjectField, value: string): { value: { singleSelectOptionId: string } | null; warning?: string } {
  const option = findSingleSelectOption(field, value);
  if (!option) {
    return { value: null, warning: `Missing option "${value}" for field "${field.name}"` };
  }
  return { value: { singleSelectOptionId: option.id } };
}

export class GitHubProjectsBridge {
  readonly env: GitHubEnv;
  readonly graphql: ReturnType<typeof createGitHubClients>["graphql"];
  readonly octokit: ReturnType<typeof createGitHubClients>["octokit"];

  constructor(env: GitHubEnv) {
    this.env = env;
    const clients = createGitHubClients(env.GITHUB_TOKEN);
    this.graphql = clients.graphql;
    this.octokit = clients.octokit;
  }

  static fromEnv(): GitHubProjectsBridge {
    return new GitHubProjectsBridge(loadGitHubEnv());
  }

  static fromToken(
    token: string,
    baseEnv: Pick<GitHubEnv, "GITHUB_OWNER" | "GITHUB_REPO" | "GITHUB_PROJECT_NUMBER">,
  ): GitHubProjectsBridge {
    return new GitHubProjectsBridge({
      GITHUB_TOKEN: token,
      GITHUB_OWNER: baseEnv.GITHUB_OWNER,
      GITHUB_REPO: baseEnv.GITHUB_REPO,
      GITHUB_PROJECT_NUMBER: baseEnv.GITHUB_PROJECT_NUMBER,
    });
  }

  get repo(): GitHubRepoRef {
    return { owner: this.env.GITHUB_OWNER, repo: this.env.GITHUB_REPO };
  }

  async whoami(): Promise<WhoAmIResult> {
    const [login, repo, project] = await Promise.all([
      getViewerLogin(this.graphql),
      getRepositoryNodeId(this.graphql, this.env.GITHUB_OWNER, this.env.GITHUB_REPO),
      getProjectByNumber(this.graphql, this.env.GITHUB_OWNER, this.env.GITHUB_PROJECT_NUMBER),
    ]);
    return { login, repo, project };
  }

  async listProjectItems(owner = this.env.GITHUB_OWNER, projectNumber = this.env.GITHUB_PROJECT_NUMBER): Promise<ProjectListResult> {
    const project = await getProjectByNumber(this.graphql, owner, projectNumber);
    const items = await listProjectItems(this.graphql, project.id);
    return { project, items };
  }

  async getConfiguredProject(owner = this.env.GITHUB_OWNER, projectNumber = this.env.GITHUB_PROJECT_NUMBER): Promise<ProjectSummary> {
    return getProjectByNumber(this.graphql, owner, projectNumber);
  }

  async getProjectFields(projectId: string): Promise<ProjectField[]> {
    return getProjectFields(this.graphql, projectId);
  }

  async createIssue(input: { repo?: string; title: string; body?: string; labels?: string[] }): Promise<IssueCreateResult> {
    const repo = input.repo ? parseRepoRef(input.repo) : this.repo;
    return createIssue(this.octokit, repo, { title: input.title, body: input.body, labels: input.labels });
  }

  async addIssueToProject(owner: string, projectNumber: number, issueNodeId: string): Promise<{ itemId: string; project: ProjectSummary }> {
    const project = await getProjectByNumber(this.graphql, owner, projectNumber);
    const result = await addIssueToProject(this.graphql, project.id, issueNodeId);
    return { ...result, project };
  }

  async setProjectField(input: { projectId: string; itemId: string; fieldName: string; value: string }) {
    const fields = await getProjectFields(this.graphql, input.projectId);
    const field = findFieldByName(fields, input.fieldName);
    if (!field) {
      throw new Error(`Field not found: ${input.fieldName}`);
    }
    const payload = field.type === "single_select" ? inferSingleSelectValue(field, input.value) : null;
    if (field.type === "single_select") {
      if (!payload?.value) {
        throw new Error(payload?.warning ?? `Missing option for ${field.name}`);
      }
      return setProjectFieldValue(this.graphql, {
        projectId: input.projectId,
        itemId: input.itemId,
        fieldId: field.id,
        value: payload.value,
      });
    }
    const value = field.type === "number" ? Number(input.value) : input.value;
    return setProjectFieldValue(this.graphql, {
      projectId: input.projectId,
      itemId: input.itemId,
      fieldId: field.id,
      value,
    });
  }

  async commentIssue(input: { repo?: string; number: number; body: string }): Promise<CommentResult> {
    const repo = input.repo ? parseRepoRef(input.repo) : this.repo;
    return commentIssue(this.octokit, repo, { number: input.number, body: input.body });
  }

  async commentPullRequest(input: { repo?: string; number: number; body: string }): Promise<CommentResult> {
    const repo = input.repo ? parseRepoRef(input.repo) : this.repo;
    return commentPullRequestConversation(this.octokit, repo, { number: input.number, body: input.body });
  }

  async importCsv(input: { file: string } & ImportCsvOptions): Promise<ImportReport> {
    const project = await getProjectByNumber(this.graphql, this.env.GITHUB_OWNER, this.env.GITHUB_PROJECT_NUMBER);
    const fields = await getProjectFields(this.graphql, project.id);
    const rows = parseCsv(readFileSync(input.file, "utf8"));
    const limit = input.limit ?? 20;
    const report: ImportReport = {
      sourceFile: input.file,
      dryRun: Boolean(input.dryRun),
      limit,
      processed: 0,
      created: 0,
      skipped: 0,
      failed: 0,
      rows: [],
    };

    for (const [index, row] of rows.slice(0, limit).entries()) {
      const rowNumber = index + 2;
      const title = getCell(row, ["Title", "Task", "Name"]);
      if (!title) {
        report.failed += 1;
        report.rows.push({ row: rowNumber, title: "", status: "failed", warnings: [], error: "Missing title column" });
        continue;
      }

      const priority = getCell(row, ["Priority"]);
      const area = getCell(row, ["Area", "Category"]);
      const agent = getCell(row, ["Agent"]);
      const body = getCellRaw(row, ["Body", "Notes", "Description"]) || buildIssueBody({ priority, area, agent });
      const labels = parseLabels(getCell(row, ["Labels"]));
      const warnings: string[] = [];

      const existing = input.skipExisting
        ? await findOpenIssueByExactTitle(this.octokit, this.repo, title)
        : null;
      if (existing) {
        report.skipped += 1;
        report.rows.push({
          row: rowNumber,
          title,
          status: "skipped",
          warnings: [`Open issue already exists: #${existing.number}`],
        });
        continue;
      }

      if (input.dryRun) {
        report.processed += 1;
        report.rows.push({
          row: rowNumber,
          title,
          status: "dry-run",
          warnings: [],
        });
        continue;
      }

      try {
        const issue = await createIssue(this.octokit, this.repo, { title, body, labels });
        const rowResult: ImportRowResult = { row: rowNumber, title, status: "created", issue, projectItemId: null, warnings: [] };
        try {
          const added = await addIssueToProject(this.graphql, project.id, issue.nodeId);
          rowResult.projectItemId = added.itemId;

          const fieldAssignments: Array<{ fieldName: string; value: string }> = [];
          if (priority) fieldAssignments.push({ fieldName: "Priority", value: priority });
          if (area) fieldAssignments.push({ fieldName: "Area", value: area });
          if (agent) fieldAssignments.push({ fieldName: "Agent", value: agent });
          const statusValue = getCell(row, ["Status"]);
          if (statusValue) fieldAssignments.push({ fieldName: "Status", value: statusValue });

          for (const assignment of fieldAssignments) {
            const field = findFieldByName(fields, assignment.fieldName);
            if (!field) {
              rowResult.warnings.push(`Missing field "${assignment.fieldName}"`);
              continue;
            }
            if (field.type === "single_select") {
              const selection = inferSingleSelectValue(field, assignment.value);
              if (!selection.value) {
                rowResult.warnings.push(selection.warning ?? `Missing option for ${assignment.fieldName}`);
                continue;
              }
              await setProjectFieldValue(this.graphql, {
                projectId: project.id,
                itemId: added.itemId,
                fieldId: field.id,
                value: selection.value,
              });
              continue;
            }
            if (field.type === "text") {
              await setProjectFieldValue(this.graphql, {
                projectId: project.id,
                itemId: added.itemId,
                fieldId: field.id,
                value: assignment.value,
              });
              continue;
            }
            rowResult.warnings.push(`Unsupported field type "${field.type}" for "${assignment.fieldName}"`);
          }
          report.created += 1;
          report.rows.push(rowResult);
        } catch (error) {
          rowResult.status = "failed";
          rowResult.error = formatGitHubError(error);
          report.failed += 1;
          report.rows.push(rowResult);
        }
      } catch (error) {
        report.failed += 1;
        report.rows.push({
          row: rowNumber,
          title,
          status: "failed",
          warnings,
          error: formatGitHubError(error),
        });
      }
      report.processed += 1;
    }

    return report;
  }
}
