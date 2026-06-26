# Sigrid Security Improvements

## Overview

This document explains the security improvements we made after reviewing the Sigrid Security results for Brain Wiz

At the start, Sigrid showed a low security score of **2.4**. After checking the findings, fixing the real issues, and documenting false positives, the security score improved to **5.0**

The work mainly focused on Docker security, Nginx configuration, database exposure, dependency findings, and making sure the application runs with safer defaults

## Initial Situation

The first Sigrid result showed a security score of **2.4**

This was mainly caused by infrastructure and configuration issues, not by the game logic itself. Most findings were related to how the application was started and exposed through Docker and Nginx

The main problems were:

- The application container had more permissions than needed
- Docker capabilities were not strict enough
- Some services were exposed too easily during development
- The database port could be exposed too broadly
- Nginx/proxy configuration was active when it was not always needed
- Sigrid reported dependency/package-lock findings that needed to be checked
- Some findings looked worse on the dashboard because the latest branch/merge had not fully updated yet

## Fix 1: Docker Container Hardening

### Problem

Sigrid complained that the Docker container was running with unnecessary permissions

This is a security risk because if an attacker ever gets access to the container, extra permissions can make the impact bigger. A container should only have the permissions it really needs

### What we changed

We hardened the application container by using safer Docker settings

The important change was removing unnecessary Linux capabilities. Earlier, `cap_add` was added again, but after reviewing it we saw that the application does not need extra Linux capabilities to run

So we removed it again

### Why this fixes the issue

The application is a Node/NestJS server. It does not need special Linux permissions. By removing `cap_add`, the container follows the principle of least privilege

This means:

- The container gets fewer system permissions
- The attack surface is smaller
- The container is safer if something goes wrong
- Sigrid no longer sees unnecessary privileges as a security risk

### Final decision

We kept the container strict instead of giving it extra permissions

The reasoning was:

```text
The application does not need extra Linux capabilities to run
Adding cap_add gives the container more permissions than needed
For security it is better to remove it and keep the container limited
```

## Fix 2: Removed Unnecessary Container Privileges

### Problem

Sigrid also flagged that the container setup was not strict enough against privilege escalation

Privilege escalation means that a process inside the container could try to gain more permissions than it should have

### What we changed

We added or kept Docker hardening settings such as:

```yaml
security_opt:
  - no-new-privileges:true
cap_drop:
  - ALL
```

### Why this fixes the issue

`no-new-privileges` prevents processes inside the container from gaining extra privileges

`cap_drop: ALL` removes default Linux capabilities from the container

Together, these settings make the container much safer because the application only runs with the minimum permissions it needs

## Fix 3: Nginx Proxy Configuration

### Problem

The Nginx proxy was part of the Docker setup, but it was not always needed during development

If Nginx is always started, it can expose extra ports and services that are not needed for normal local testing

This increases the attack surface and makes the setup less clean

### What we changed

We moved Nginx behind a Docker Compose profile

Example:

```yaml
nginx:
  profiles:
    - proxy
```

### Why this fixes the issue

Now Nginx only runs when the proxy profile is explicitly enabled

This means:

- Local development stays simpler
- Unused proxy services are not exposed by default
- The application has fewer open services during normal development
- Sigrid sees a cleaner and safer configuration

## Fix 4: Database Port Exposure

### Problem

The PostgreSQL database port was exposed too broadly

If a database port is bound to all network interfaces, other devices on the network may be able to reach it. For local development this is not needed and creates unnecessary risk

### What we changed

We changed the database port binding so it only listens on localhost

```yaml
db:
  ports:
    - '127.0.0.1:${DB_PORT:-5432}:5432'
```

### Why this fixes the issue

Binding PostgreSQL to `127.0.0.1` means the database is only reachable from the local machine

This is safer because:

- The database is not exposed to the whole network
- Other devices cannot connect to it directly
- Local development still works
- The risk of accidental database exposure is reduced

## Fix 5: Removed Unused / Risky Configuration

### Problem

Some configuration was not needed anymore or caused extra security concerns

For example, unused services or environment variables can make the Docker setup harder to understand and easier to misconfigure

### What we changed

We cleaned up the Docker configuration and removed parts that were not needed for the current setup

This included reviewing services like proxy-related configuration and making sure only the needed services run by default

### Why this fixes the issue

A smaller configuration is easier to secure

Every extra service, port, or variable adds possible risk. By removing unused configuration, the project becomes easier to review and safer to run

## Fix 6: Package-lock Integrity Finding

### Problem

Sigrid reported an integrity-related finding in `package-lock.json`

At first this looked like a dependency security issue, because npm packages normally include integrity hashes in the lockfile

### What we checked

We manually checked the package-lock entries that Sigrid reported

The missing integrity values were related to local workspace packages in the monorepo, not external npm packages downloaded from npm

Workspace packages are linked locally inside the project. Because of that, they do not always have the same integrity field as external packages

### Result

This was treated as a false positive

It was not ignored blindly. We checked why the integrity values were missing and confirmed that the affected entries were local workspace links

### Why this is safe

The finding did not mean that external dependencies were unprotected

External packages still use the normal lockfile mechanism. The reported entries were local workspace references, which are part of the repository itself

## Fix 7: Better Runtime Safety

### Problem

Some backend behavior needed to be checked to make sure invalid input is handled safely

For example, room codes are user input. Invalid room codes should not be passed directly into the system without validation

### What we improved / verified

The backend validates room code format before trying to use it

Invalid room codes return a controlled error instead of being processed further

The server also normalizes valid room codes before lookup

### Why this helps

This protects the backend from malformed input and keeps the API behavior predictable

It also avoids unnecessary database queries for invalid room codes

## Fix 8: Safer Database Startup Handling

### Problem

The application should not silently continue if the database is not correctly available

If the database connection or schema is broken, the server should fail early instead of running in a bad state

### What we improved / verified

The database module validates the connection on startup

It also runs a simple schema validation query to confirm that the database is reachable

### Why this helps

This makes deployment safer because problems are detected during startup

The application does not continue running if the database is not correctly initialized

## Score Improvement

Before the fixes, Sigrid showed a security score of **2.4**

After applying the security improvements, the score improved to **5.0**

The biggest improvements came from:

- Removing unnecessary Docker capabilities
- Preventing privilege escalation in the container
- Not exposing Nginx/proxy by default
- Binding the database port to localhost
- Cleaning up unused configuration
- Reviewing the package-lock integrity finding
- Documenting the false positive clearly

## Final Result

After the fixes, the security setup is stricter and cleaner

The application now runs with fewer permissions, exposes fewer services by default, and has safer Docker and database configuration

The final result is:

```text
Security score before: 2.4
Security score after: 5.0
```

## Summary of Changes

| Area                 | Problem                                 | Fix                                                    |
| -------------------- | --------------------------------------- | ------------------------------------------------------ |
| Docker capabilities  | Container had unnecessary permissions   | Removed unnecessary `cap_add` and dropped capabilities |
| Privilege escalation | Container could be less restricted      | Added/kept `no-new-privileges`                         |
| Nginx                | Proxy was active when not always needed | Moved Nginx behind a `proxy` profile                   |
| Database             | PostgreSQL could be exposed too broadly | Bound database port to `127.0.0.1`                     |
| Config               | Unused setup increased complexity       | Cleaned up unused Docker/proxy configuration           |
| Package-lock         | Sigrid reported missing integrity       | Checked and documented workspace-link false positive   |
| Backend input        | Room codes are user input               | Validated room code format before lookup               |
| Database startup     | App should fail early on DB issues      | Verified database connection and schema on startup     |

## Conclusion

The Sigrid security work improved the project from a low security score of **2.4** to **5.0**

Most of the work was focused on securing the runtime environment around the application. The biggest improvements came from hardening Docker, limiting exposed services, making the database safer in development, and reviewing Sigrid findings carefully instead of blindly ignoring them

The result is a more secure and better documented setup for Brain Wiz
