<!-- U5a prompt template, level none (BR-U5a-52). One template per task section below; each has exactly one type-check command placeholder. -->
<!-- task: task-management -->
Build a TypeScript REST API with Express for task management. Users can create projects, add tasks to a project with a title, a description, an optional due date and a status of todo, in progress or done, assign a task to a user, list the tasks of a project filtered by status or assignee, and mark a task as done. A task cannot be marked done twice, and only existing users can be assignees. Keep all data in memory; there is no database. Expose the API from a small HTTP server entry point.

Organise the source code under src/ in exactly three folders: src/domain, src/application and src/infrastructure.

Environment: the working directory already contains package.json and a read-only node_modules with exactly these packages: typescript, @types/node, express and @types/express. Node built-in modules are also available. There is no network access and npm is not available, so do not install, add or update any package, and do not modify package.json or node_modules. Write TypeScript files only, under src/. The project is type-checked in strict mode with target ES2022 and lib ES2022, CommonJS modules, node module resolution, esModuleInterop, skipLibCheck and forceConsistentCasingInFileNames enabled, no emit and no incremental build; type definitions are read from node_modules/@types and only the node types are loaded globally. To type-check your work, run exactly this command, with nothing added or changed:

{{TYPECHECK_COMMAND}}

The work is finished when that command reports no errors.
<!-- task: order-fulfilment -->
Build a TypeScript REST API with Express for order fulfilment. Customers place orders for catalogue products with quantities; placing an order reserves stock and fails when stock is insufficient. An order moves through the states placed, paid, packed, shipped and delivered, in that order only. An order can be cancelled before it is shipped, which releases its reserved stock. Staff can list orders by state and see the stock level of each product. Keep all data in memory; there is no database. Expose the API from a small HTTP server entry point.

Organise the source code under src/ in exactly three folders: src/domain, src/application and src/infrastructure.

Environment: the working directory already contains package.json and a read-only node_modules with exactly these packages: typescript, @types/node, express and @types/express. Node built-in modules are also available. There is no network access and npm is not available, so do not install, add or update any package, and do not modify package.json or node_modules. Write TypeScript files only, under src/. The project is type-checked in strict mode with target ES2022 and lib ES2022, CommonJS modules, node module resolution, esModuleInterop, skipLibCheck and forceConsistentCasingInFileNames enabled, no emit and no incremental build; type definitions are read from node_modules/@types and only the node types are loaded globally. To type-check your work, run exactly this command, with nothing added or changed:

{{TYPECHECK_COMMAND}}

The work is finished when that command reports no errors.
