# Architecture

This codebase follows a layered architecture. From top to bottom the layers are presentation, business and
persistence. Every change keeps this rule.

1. **Lower layers never depend on upper layers.** A layer may use the layers below it and never the layers above it:
   persistence never uses business or presentation code, and business code never uses presentation code.
