# CLA Bot

GitHub Action that blocks pull requests until each required contributor signs your CLA by posting a matching PR comment.

If you build or test this repository locally, use Node 24.

## Recommended Modes

Use these modes in this order.

1. Same repository + `issue` backend
   This is the default recommendation. No extra token, no extra repository, no extra commits.
2. Cross-repository + `issue` backend
   Use this if you do not want CLA issues in the target repository. Requires `registry-token`.
3. Same repository + `json-repo` backend on a dedicated branch
   Use this if you want file-based signature records but do not want them on your default branch.
4. Cross-repository + `json-repo` backend
   This is the most operationally heavy mode. Use it only if you specifically want file-based records in a separate repository.

If you just want CLA enforcement to work with the least setup, start with same repository + `issue`.

## Quick Start

Replace `your-org/your-repo` with the repository that runs the workflow.

Add `.github/cla.yml`:

```yaml
document:
  version: v1
  url: https://example.com/cla/v1

registry:
  type: issue
  repository: your-org/your-repo
```

Add `.github/workflows/cla.yml`:

```yaml
name: CLA Check

on:
  pull_request_target:
    types: [opened, synchronize, reopened]
  issue_comment:
    types: [created]

permissions:
  contents: write
  pull-requests: write
  issues: write
  checks: write

jobs:
  cla:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run CLA Bot
        uses: overtrue/cla-bot@v0.0.5
        with:
          github-token: ${{ github.token }}
```

Open a pull request. The bot will post signing instructions when a signature is missing.

Copy-ready examples:

- [Same-repo issue config](./examples/cla.yml)
- [Same-repo workflow](./examples/workflow.same-repo.yml)

## How It Works

```mermaid
flowchart LR
  A["Pull request opened"] --> B["CLA Check runs"]
  B --> C{"All required contributors signed?"}
  C -->|No| D["Bot posts signing instructions"]
  D --> E["Missing contributor comments matching CLA phrase"]
  E --> F["CLA Check runs again"]
  F --> C
  C -->|Yes| G["PR can be merged"]
```

## How Contributors Sign

When a PR is missing signatures, the bot posts a comment listing the missing contributors.

Each missing contributor must comment:

```text
I have read and agree to the CLA.
```

By default the bot checks:

- the PR author
- all commit authors

## `.github/cla.yml`

The file does not need to be fully specified. This is the smallest useful config:

```yaml
document:
  version: v1
  url: https://example.com/cla/v1

registry:
  type: issue
  repository: your-org/your-repo
```

Everything else falls back to sensible defaults.

Full example using the `issue` backend:

```yaml
enabled: true

document:
  version: v1
  url: https://example.com/cla/v1

signing:
  mode: comment
  comment_pattern: I have read and agree to the CLA.
  case_insensitive: true
  trim_whitespace: true
  ignore_terminal_punctuation: true

contributors:
  check_pr_author: true
  check_commit_authors: true
  check_coauthors: false
  exclude_bots: true
  allowlist:
    - dependabot[bot]
    - github-actions[bot]

registry:
  type: issue
  repository: your-org/your-repo

status:
  check_name: CLA Check
  comment_tag: <!-- cla-bot -->
```

When `contributors.check_commit_authors` is enabled, CLA Bot ignores merge commits that only sync the PR base branch into the PR branch, such as merging `main` into a feature branch.

## Registry Backends

### `issue`

Use `issue` if you want the simplest setup and easy manual inspection.

```yaml
registry:
  type: issue
  repository: your-org/your-repo
```

### `json-repo`

Use `json-repo` if you want one JSON file per signer.

```yaml
registry:
  type: json-repo
  repository: your-org/your-cla-registry
  path_prefix: signatures
```

If you want `json-repo` in the same repository without polluting the default branch, set `registry.branch`:

```yaml
registry:
  type: json-repo
  repository: your-org/your-repo
  path_prefix: signatures
  branch: cla-signatures
```

When `registry.branch` is set, CLA Bot reads and writes JSON signature files on that branch. If the branch does not exist yet, CLA Bot creates it from the repository's default branch on first write.

Copy-ready examples:

- [Same-repo issue config](./examples/cla.yml)
- [Same-repo json-repo on a dedicated branch](./examples/cla.json-branch.yml)
- [Cross-repo json-repo config](./examples/cla.json-repo.yml)

## Workflow Examples

### Same Repository

For same-repo `issue`, and for same-repo `json-repo` on a dedicated branch, `github.token` is enough:

```yaml
name: CLA Check

on:
  pull_request_target:
    types: [opened, synchronize, reopened]
  issue_comment:
    types: [created]

permissions:
  contents: write
  pull-requests: write
  issues: write
  checks: write

jobs:
  cla:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run CLA Bot
        uses: overtrue/cla-bot@v0.0.5
        with:
          github-token: ${{ github.token }}
```

### Cross Repository

If the registry repository is different from the target repository, pass `registry-token`:

```yaml
name: CLA Check

on:
  pull_request_target:
    types: [opened, synchronize, reopened]
  issue_comment:
    types: [created]

permissions:
  contents: write
  pull-requests: write
  issues: write
  checks: write

jobs:
  cla:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run CLA Bot
        uses: overtrue/cla-bot@v0.0.5
        with:
          github-token: ${{ github.token }}
          registry-token: ${{ secrets.CLA_BOT_REGISTRY_TOKEN }}
```

Copy-ready examples:

- [Cross-repo workflow with PAT or pre-minted token](./examples/workflow.yml)
- [Cross-repo workflow with GitHub App token minting](./examples/workflow.github-app.yml)

## Customize Templates

Use `templates` if you want to customize commit messages, PR comments, or check output.

Supported template keys:

| Key | Used for | Typical content |
| --- | --- | --- |
| `templates.registry.commit_message` | `json-repo` commit message | One-line Git commit message |
| `templates.pr.missing_comment` | PR comment when signatures are missing | Signing instructions and missing contributors |
| `templates.pr.success_comment` | PR comment when everyone has signed | Success message and optional registry links |
| `templates.check.success_title` | Success check title | Short status title |
| `templates.check.success_summary` | Success check summary | Contributors and optional registry links |
| `templates.check.failure_title` | Failure check title | Short status title |
| `templates.check.failure_summary` | Failure check summary | Missing contributors and signing instructions |
| `templates.check.disabled_title` | Disabled check title | Short status title |
| `templates.check.disabled_summary` | Disabled check summary | Explanation that CLA enforcement is disabled |

```yaml
templates:
  registry:
    commit_message: "chore: record CLA signature for {{github_login}} from {{source_repo}}#{{source_pr_number}}"
  pr:
    success_comment: |
      CLA requirements are satisfied for this pull request.

      Registry records:

      {{registry_links_markdown}}
  check:
    success_summary: |
      All required contributors have signed {{cla_version}}.

      Contributors checked:

      {{contributors_markdown}}

      Registry records:

      {{registry_links_markdown}}
```

`status.comment_tag` is still prepended automatically to PR comments. Templates should not include it.

Available placeholders for `templates.registry.commit_message`:

| Placeholder | Meaning |
| --- | --- |
| `{{github_login}}` | Signer GitHub login |
| `{{signer_type}}` | Signer type such as `individual` |
| `{{cla_version}}` | CLA document version |
| `{{source_repo}}` | Source repository in `owner/repo` form |
| `{{source_pr_number}}` | Source pull request number |
| `{{source_comment_id}}` | Source signing comment ID |
| `{{registry_repository}}` | Registry repository in `owner/repo` form |
| `{{registry_path}}` | Path to the signer JSON file inside the registry |

Available placeholders for `templates.pr.*` and `templates.check.*`:

| Placeholder | Meaning |
| --- | --- |
| `{{cla_version}}` | CLA document version |
| `{{cla_document_url}}` | CLA document URL |
| `{{cla_document_sha256}}` | CLA document SHA-256, if configured |
| `{{signing_comment_pattern}}` | Signing phrase shown to contributors |
| `{{contributors_markdown}}` | Checked contributors rendered as Markdown |
| `{{missing_contributors_markdown}}` | Missing contributors rendered as Markdown |
| `{{registry_links_markdown}}` | Registry record links rendered as Markdown |
| `{{contributors_count}}` | Number of checked contributors |
| `{{missing_count}}` | Number of missing contributors |
| `{{registry_link_count}}` | Number of rendered registry links |

`{{registry_links_markdown}}` works for both backends. For `json-repo`, the links point to the signer JSON file. For `issue`, the links point to the signer issue.

## Cross-Repo Token Setup

`github-token`

- Required.
- Used to read the target repository and update PR comments and checks.
- In workflows, use `${{ github.token }}` unless you intentionally replace it.

`registry-token`

- Optional for same-repo setups.
- Required when `registry.repository` points to a different repository.
- Used only for the registry repository.

If `registry.repository` is different from the repository running the workflow, `${{ github.token }}` is usually not enough by itself. You need another credential for the registry repository.

### PAT Mode

This is the simplest cross-repo setup.

- Create a fine-grained PAT that can access the registry repository.
- Store it as `CLA_BOT_REGISTRY_TOKEN`.
- Pass it as `registry-token`.

Permission requirements:

- `issue` backend: issue read/write access on the registry repository
- `json-repo` backend: contents read/write access on the registry repository

Operational impact of PAT mode:

- The registry writer identity is the PAT owner.
- Rotation and revocation are tied to a user account.
- This is a good short-term or small-team solution.
- This is usually not the best long-term organization-wide setup.

### GitHub App Mode

This is the recommended long-term cross-repo setup.

Users create and manage their own GitHub App. CLA Bot does not require a shared vendor-managed app.

Setup flow:

1. [Create a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app) for CLA Bot use.
2. Choose only the repository permissions needed by your registry backend. See [Choosing permissions for a GitHub App](https://docs.github.com/en/enterprise-cloud@latest/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app).

   | Backend | Repository permission |
   | --- | --- |
   | `issue` | `Issues: Read & write` |
   | `json-repo` | `Contents: Read & write` |

   No extra organization permissions, account permissions, or webhook subscriptions are required for CLA Bot's cross-repo registry token flow. GitHub may also show read-only metadata access during install, which is expected.

3. [Install the app](https://docs.github.com/en/developers/apps/managing-github-apps/installing-github-apps) on the registry repository, ideally using "Only select repositories" and choosing just your registry repository.
4. Download a private key for the app.
5. Store the app ID as `CLA_BOT_APP_ID` in Actions variables.
6. Store the private key as `CLA_BOT_APP_PRIVATE_KEY` in Actions secrets.
7. In the workflow, use `actions/create-github-app-token@v3` to mint a short-lived installation token and pass it as `registry-token`.

Example for a cross-repo `issue` backend. Replace `your-org` and `your-cla-registry` with your own registry repository:

```yaml
- name: Create token for registry repo
  id: registry-token
  uses: actions/create-github-app-token@v3
  with:
    app-id: ${{ vars.CLA_BOT_APP_ID }}
    private-key: ${{ secrets.CLA_BOT_APP_PRIVATE_KEY }}
    owner: your-org
    repositories: your-cla-registry
    permission-issues: write

- name: Run CLA Bot
  uses: overtrue/cla-bot@v0.0.5
  with:
    github-token: ${{ github.token }}
    registry-token: ${{ steps.registry-token.outputs.token }}
```

If you use the `json-repo` backend, change the app token permission to `permission-contents: write`.

Operational impact of GitHub App mode:

- The registry writer identity is the app installation, not a human signer.
- Tokens are short-lived and minted inside the workflow.
- Permissions are easier to scope and rotate than PATs.
- This is the better fit for long-lived team or organization setups.

## Registry Writer Identity

The registry is written by the token identity, not by the human signer.

- `issue` backend: the issue and comments are created by the identity behind `registry-token` or `github-token`.
- `json-repo` backend: the commit is authored by the identity behind `registry-token` or `github-token`.
- The actual signer is still recorded in the issue body or JSON payload as `github_login`.

If you want the cleanest audit trail for humans, prefer `issue`.

## Use with AI

If you want an AI coding tool to integrate CLA Bot for you, give it this prompt and adjust the repository names:

```text
Integrate CLA Bot into this repository.

Requirements:
- Start with same-repo issue backend
- Add .github/cla.yml with the minimal working config
- Point registry.repository at this repository
- Add .github/workflows/cla.yml for pull_request_target and issue_comment
- Use github.token for github-token
- Do not add registry-token unless registry.repository is a different repository
- Keep the setup simple and do not add extra features

After the changes:
- summarize what was added
- list any required GitHub secrets
- explain how contributors sign the CLA
```

## Common Questions

Why is the PR still blocked after someone signed?

- Another required contributor is still missing.
- The comment text does not match the configured signing phrase.
- By default, case and surrounding whitespace are ignored, and terminal punctuation is optional.
- The repository now requires a newer CLA version.

Why was no signature record written?

- `registry.repository` points to the wrong repository.
- In cross-repo mode, `registry-token` is missing or cannot write to the registry repository.
- In `json-repo` mode, the token does not have contents write access.
- In `issue` mode, the token does not have issues write access.

Can I change the signing phrase?

- Yes. Set `signing.comment_pattern` in `.github/cla.yml`.
- Contributors must match that phrase, subject to your `case_insensitive` and `trim_whitespace` settings.
- Terminal punctuation at the end of the comment is ignored by default.
- Set `signing.ignore_terminal_punctuation: false` if you want to require exact terminal punctuation.

## License

Licensed under the [MIT License](./LICENSE).
