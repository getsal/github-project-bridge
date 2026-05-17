import { z } from "zod";

export const envSchema = z.object({
  GITHUB_TOKEN: z.string({ required_error: "GITHUB_TOKEN is required in .env" }).min(1, "GITHUB_TOKEN is required in .env"),
  GITHUB_PROJECT_OWNER: z.string({ required_error: "GITHUB_PROJECT_OWNER is required in .env" }).min(1, "GITHUB_PROJECT_OWNER is required in .env"),
  GITHUB_PROJECT_OWNER_TYPE: z.enum(["user", "org"], { required_error: "GITHUB_PROJECT_OWNER_TYPE is required in .env" }),
  GITHUB_PROJECT_NUMBER: z.coerce.number({ required_error: "GITHUB_PROJECT_NUMBER is required in .env" }).int().positive(),
  GITHUB_OWNER: z.string({ required_error: "GITHUB_OWNER is required in .env" }).min(1, "GITHUB_OWNER is required in .env"),
  GITHUB_REPO: z.string({ required_error: "GITHUB_REPO is required in .env" }).min(1, "GITHUB_REPO is required in .env"),
});

export type GitHubEnv = z.infer<typeof envSchema>;
export type ProjectOwnerType = GitHubEnv["GITHUB_PROJECT_OWNER_TYPE"];

export type FieldType = "text" | "single_select" | "number" | "date" | "iteration" | "unknown";

export interface ProjectFieldOption {
  id: string;
  name: string;
}

export interface ProjectField {
  id: string;
  name: string;
  dataType: string;
  type: FieldType;
  options: ProjectFieldOption[];
}

export interface ProjectSummary {
  id: string;
  title: string;
  number: number;
  url?: string | null;
}

export interface ProjectItemSummary {
  id: string;
  contentType: string;
  number?: number | null;
  title: string;
  status?: string | null;
  priority?: string | null;
  labels: string[];
  url?: string | null;
  fieldValues?: Record<string, string | number | null>;
}

export interface IssueCreateResult {
  number: number;
  url: string;
  nodeId: string;
}

export interface CommentResult {
  id: string;
  url?: string | null;
}

export interface ImportRowResult {
  row: number;
  title: string;
  status: "created" | "skipped" | "failed" | "dry-run";
  issue?: IssueCreateResult | null;
  projectItemId?: string | null;
  warnings: string[];
  error?: string | null;
}

export interface ImportReport {
  sourceFile: string;
  dryRun: boolean;
  limit: number;
  processed: number;
  created: number;
  skipped: number;
  failed: number;
  rows: ImportRowResult[];
}

export type GitHubRepoRef = {
  owner: string;
  repo: string;
};

export const repoRefSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});
