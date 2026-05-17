function normalizeType(dataType) {
    const value = String(dataType ?? "").toUpperCase();
    if (value.includes("SINGLE_SELECT"))
        return "single_select";
    if (value.includes("TEXT"))
        return "text";
    if (value.includes("NUMBER"))
        return "number";
    if (value.includes("DATE"))
        return "date";
    if (value.includes("ITERATION"))
        return "iteration";
    return "unknown";
}
export async function getViewerLogin(graphql) {
    const data = await graphql(`
    query {
      viewer {
        login
      }
    }
  `);
    return data.viewer.login;
}
export async function getRepositoryNodeId(graphql, owner, repo) {
    const data = await graphql(`
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          id
          nameWithOwner
        }
      }
    `, { owner, repo });
    if (!data.repository) {
        throw new Error(`Repository not found or inaccessible: ${owner}/${repo}`);
    }
    return data.repository;
}
export async function getProjectByNumber(graphql, owner, projectNumber, ownerType) {
    const query = ownerType === "user"
        ? `
      query($owner: String!, $number: Int!) {
        user(login: $owner) {
          projectV2(number: $number) {
            id
            title
            number
            url
          }
        }
      }
    `
        : `
      query($owner: String!, $number: Int!) {
        organization(login: $owner) {
          projectV2(number: $number) {
            id
            title
            number
            url
          }
        }
      }
    `;
    const data = await graphql(query, { owner, number: projectNumber });
    const project = ownerType === "user" ? data.user?.projectV2 ?? null : data.organization?.projectV2 ?? null;
    if (!project) {
        throw new Error(`Project #${projectNumber} not found for ${ownerType} ${owner}`);
    }
    return project;
}
export async function getProjectFields(graphql, projectId) {
    const fields = [];
    let after = null;
    while (true) {
        const data = await graphql(`
        query($projectId: ID!, $after: String) {
          node(id: $projectId) {
            ... on ProjectV2 {
              fields(first: 100, after: $after) {
                nodes {
                  __typename
                  id
                  name
                  dataType
                  ... on ProjectV2SingleSelectField {
                    options {
                      id
                      name
                    }
                  }
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          }
        }
      `, { projectId, after });
        const connection = data.node?.fields;
        if (!connection)
            break;
        for (const field of connection.nodes) {
            if (!field)
                continue;
            fields.push({
                id: field.id,
                name: field.name,
                dataType: field.dataType ?? "",
                type: normalizeType(field.dataType),
                options: field.options ?? [],
            });
        }
        if (!connection.pageInfo.hasNextPage)
            break;
        after = connection.pageInfo.endCursor;
    }
    return fields;
}
export async function listProjectItems(graphql, projectId) {
    const items = [];
    let after = null;
    while (true) {
        const data = await graphql(`
        query($projectId: ID!, $after: String) {
          node(id: $projectId) {
            ... on ProjectV2 {
              items(first: 100, after: $after) {
                nodes {
                  id
                  content {
                    __typename
                    ... on Issue {
                      number
                      title
                      url
                      labels(first: 100) {
                        nodes {
                          name
                        }
                      }
                    }
                    ... on PullRequest {
                      number
                      title
                      url
                      labels(first: 100) {
                        nodes {
                          name
                        }
                      }
                    }
                    ... on DraftIssue {
                      title
                      body
                    }
                  }
                  fieldValues(first: 20) {
                    nodes {
                      __typename
                      ... on ProjectV2ItemFieldTextValue {
                        text
                        field {
                          ... on ProjectV2FieldCommon {
                            name
                          }
                        }
                      }
                      ... on ProjectV2ItemFieldSingleSelectValue {
                        name
                        field {
                          ... on ProjectV2FieldCommon {
                            name
                          }
                        }
                      }
                      ... on ProjectV2ItemFieldNumberValue {
                        number
                        field {
                          ... on ProjectV2FieldCommon {
                            name
                          }
                        }
                      }
                      ... on ProjectV2ItemFieldDateValue {
                        date
                        field {
                          ... on ProjectV2FieldCommon {
                            name
                          }
                        }
                      }
                    }
                  }
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          }
        }
      `, { projectId, after });
        const connection = data.node?.items;
        if (!connection)
            break;
        for (const item of connection.nodes) {
            if (!item)
                continue;
            const content = item.content;
            const labels = content?.labels?.nodes?.flatMap((label) => (label?.name ? [label.name] : [])) ?? [];
            const fieldValues = {};
            for (const value of item.fieldValues?.nodes ?? []) {
                if (!value?.field?.name)
                    continue;
                if (value.__typename === "ProjectV2ItemFieldSingleSelectValue") {
                    fieldValues[value.field.name] = value.name ?? null;
                }
                else if (value.__typename === "ProjectV2ItemFieldTextValue") {
                    fieldValues[value.field.name] = value.text ?? null;
                }
                else if (value.__typename === "ProjectV2ItemFieldNumberValue") {
                    fieldValues[value.field.name] = value.number ?? null;
                }
                else if (value.__typename === "ProjectV2ItemFieldDateValue") {
                    fieldValues[value.field.name] = value.date ?? null;
                }
            }
            items.push({
                id: item.id,
                contentType: content?.__typename ?? "Unknown",
                number: content?.number ?? null,
                title: content?.title ?? "",
                status: typeof fieldValues.Status === "string" ? fieldValues.Status : null,
                priority: typeof fieldValues.Priority === "string" ? fieldValues.Priority : null,
                labels,
                url: content?.url ?? null,
                fieldValues,
            });
        }
        if (!connection.pageInfo.hasNextPage)
            break;
        after = connection.pageInfo.endCursor;
    }
    return items;
}
export async function addIssueToProject(graphql, projectId, issueNodeId) {
    const data = await graphql(`
      mutation($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
          item {
            id
          }
        }
      }
    `, { projectId, contentId: issueNodeId });
    const item = data.addProjectV2ItemById.item;
    if (!item) {
        throw new Error("Project item was not created");
    }
    return { itemId: item.id };
}
export async function setProjectFieldValue(graphql, input) {
    const value = typeof input.value === "object" && input.value !== null
        ? input.value
        : typeof input.value === "number"
            ? { number: input.value }
            : { text: input.value };
    const data = await graphql(`
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $projectId,
          itemId: $itemId,
          fieldId: $fieldId,
          value: $value
        }) {
          projectV2Item {
            id
          }
        }
      }
    `, { projectId: input.projectId, itemId: input.itemId, fieldId: input.fieldId, value });
    const item = data.updateProjectV2ItemFieldValue.projectV2Item;
    if (!item) {
        throw new Error("Project field update did not return an item");
    }
    return { projectItemId: item.id };
}
export function findFieldByName(fields, name) {
    const normalized = name.trim().toLowerCase();
    return fields.find((field) => field.name.trim().toLowerCase() === normalized) ?? null;
}
export function findSingleSelectOption(field, value) {
    const normalized = value.trim().toLowerCase();
    return field.options.find((option) => option.name.trim().toLowerCase() === normalized) ?? null;
}
