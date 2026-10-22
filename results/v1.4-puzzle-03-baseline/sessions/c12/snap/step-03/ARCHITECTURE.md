# Architecture

This codebase follows a layered architecture. From top to bottom the layers are presentation, business and
persistence. Every change keeps these rules.

1. **Lower layers never depend on upper layers.** A layer may use the layers below it and never the layers above it:
   persistence never uses business or presentation code, and business code never uses presentation code.
2. **Each layer talks only to the layer directly below it.** Presentation calls business code and never reaches
   persistence code itself; business code is the only user of persistence code.
