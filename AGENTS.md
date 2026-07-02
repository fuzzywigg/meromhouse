# AGENTS.md — meromhouse

parent_governance: github.com/fuzzywigg/agents-governance

## Classification
- Tier: A (Active Strategic — public brand asset)
- Autonomy: L1 (Bounded)
- Stack: Static HTML, CF Pages, CF Pages Functions

## Purpose
Andrew's public KPI dashboard at meromhouse.org. Real-time view of active projects, research, and deployment status. Target: employers, collaborators, funders.

## Safe Agent Actions
- Update project status badges in index.html
- Add new data cards
- Improve the github-stats API response shape
- Update hardcoded counts (deploy count, project list)
- Update DEPLOY.md

## Escalate to Human (HITL Required)
- Any first deploy to CF Pages
- Adding new external API credentials to CF environment
- Domain/DNS changes for meromhouse.org or fuzzywigg.com
- Publishing or deleting any content visible at the live URL
