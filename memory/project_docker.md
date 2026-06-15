---
name: project-docker-deployment
description: Le projet coach-running tourne sur Docker, pas en local. Ne pas faire de npm install ou lancer de process locaux.
metadata:
  type: project
---

Le projet tourne entièrement sur Docker (docker-compose), pas en local sur la machine de dev.

**Why:** L'environnement local n'est qu'un repo de code, l'exécution se fait dans des containers.

**How to apply:** Ne jamais lancer `npm install`, `npm run dev`, `node`, etc. en local. Proposer uniquement des Dockerfiles et docker-compose. Pour tester, suggérer `docker compose up`.
