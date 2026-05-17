import { z } from "zod";
export const envSchema = z.object({
    GITHUB_TOKEN: z.string({ required_error: "GITHUB_TOKEN is required in .env" }).min(1, "GITHUB_TOKEN is required in .env"),
    GITHUB_OWNER: z.string({ required_error: "GITHUB_OWNER is required in .env" }).min(1, "GITHUB_OWNER is required in .env"),
    GITHUB_REPO: z.string({ required_error: "GITHUB_REPO is required in .env" }).min(1, "GITHUB_REPO is required in .env"),
    GITHUB_PROJECT_NUMBER: z.coerce.number({ required_error: "GITHUB_PROJECT_NUMBER is required in .env" }).int().positive(),
});
export const repoRefSchema = z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
});
