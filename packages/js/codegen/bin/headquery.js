#!/usr/bin/env node
// Committed entry point so package managers can link the `headquery` bin before `dist/` is
// built (pnpm skips missing bin targets in workspaces). Loads the built CLI.
import "../dist/cli.js";
