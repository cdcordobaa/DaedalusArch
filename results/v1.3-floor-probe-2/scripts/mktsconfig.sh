#!/bin/sh
# usage: mktsconfig.sh <projdir>  -> writes <projdir>/tsconfig.json (harness options, BR-U5a-48)
R=$(cd "$1" && pwd)
cat > "$R/tsconfig.json" <<J
{
  "compilerOptions": {
    "strict": true, "target": "ES2022", "lib": ["ES2022"], "module": "commonjs", "moduleResolution": "node",
    "esModuleInterop": true, "skipLibCheck": true, "forceConsistentCasingInFileNames": true, "noEmit": true,
    "incremental": false, "typeRoots": ["$R/node_modules/@types"], "types": ["node"]
  },
  "include": ["$R/src/**/*.ts"]
}
J
