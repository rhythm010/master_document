# SYSTEM CONTRACT — SDS GOVERNANCE

This document defines the structure, scope, and interaction rules for all System Design Specification (SDS) documents.

---

# 1. SDS TYPES AND THEIR RESPONSIBILITIES

---

## 1.1 Core SDS

Location: `/SDS/core_sds.md`

Defines:

* core entities (logical)
* global state machines
* system invariants
* relationships

Does NOT define:

* APIs
* DB schema
* feature logic

Core SDS is the **system truth**.

---

## 1.2 Feature SDS

Location: `/SDS/feature-sds/<feature>.feature-sds.md`

Defines:

* API contract
* business logic (step-by-step)
* DB operations (mapped to schema)
* validations
* concurrency rules
* failure cases

Each Feature SDS:

* represents ONE atomic behavior
* must follow `/SDS/templates/feature_SDS_template.md`

---

## 1.3 Data Model (Schema)

Location: `/SDS/data-model/schema.md`

Defines:

* tables
* columns
* constraints
* relationships
* indexes

Schema is the **physical implementation of Core SDS**.

---

## 1.4 Template

Location: `/SDS/templates/feature_SDS_template.md`

Defines:

* mandatory structure for all Feature SDS
* section order and naming

No Feature SDS may deviate from this template.

---

## 1.5 Tooling Definition

Location: `/SDS/tech-stack.md`

Defines:

* frameworks (Node.js, Express, etc.)
* libraries (ORM, validation, etc.)
* patterns (layered architecture)

---

# 2. LINKING RULES (CRITICAL)

---

## 2.1 Feature SDS → Core SDS

Feature SDS MUST:

* use entities defined in Core SDS
* follow state transitions
* respect invariants

---

## 2.2 Feature SDS → Schema

Feature SDS MUST:

* map DB operations to schema tables
* use correct field names
* not introduce undefined fields

---

## 2.3 Feature SDS → Tooling

Every Feature SDS MUST include:

### Tooling Section (MANDATORY)

Example:

```text
## Tooling

- Framework: Express.js
- ORM: Prisma
- Validation: Zod
- Transaction Handling: Prisma transactions
```

Rules:

* Must reference `/SDS/tech-stack.md`
* Must not introduce new tools without approval

---

## 2.4 Feature SDS → Master Document

Feature SDS MUST:

* align with flows defined in `/master-document/`
* not contradict business flow

---

# 3. OWNERSHIP RULES

---

| Document    | Role                    |
| ----------- | ----------------------- |
| Core SDS    | system truth            |
| Schema      | system structure        |
| Feature SDS | system behavior         |
| Template    | structure enforcement   |
| Tooling     | implementation standard |

---

# 4. UPDATE RULES

---

## 4.1 Core Documents (STRICT)

These MUST NOT be updated automatically:

* /master-document/
* /SDS/core_sds.md
* /SDS/data-model/schema.md

Changes require:

* explicit approval

---

## 4.2 Feature SDS

* can be created or updated freely
* must adapt to core documents

---

## 4.3 Tooling File

* referenced by Feature SDS
* must remain consistent
* changes require approval

---

# 5. CONFLICT RESOLUTION

If conflict occurs:

Priority order:

1. Core SDS
2. Schema
3. Master Document
4. Tooling
5. Feature SDS

Feature SDS must adapt unless approved otherwise.

---

# 6. FINAL PRINCIPLE

Core SDS defines truth.
Schema enforces truth.
Feature SDS executes truth.
Tooling implements execution.

All Feature SDS must align with all three.
