# Carpenter Production Management System (CPMS)
Manufacturing Execution & Resource Planning Engine

## Project Context
A full-stack ERP system designed to manage complex carpentry production lines. The system focuses on automating the supply chain, optimizing human resource allocation, and providing real-time communication infrastructure for production teams.

## System Capabilities

### Centralized & Automated Procurement Engine
The core logic engine manages the transition from project specifications to raw material acquisition:
- **Requirement Aggregation:** Automated logic that scans active orders, extracts Material Requirements (BOM), and aggregates them into a centralized procurement list.
- **Automated Requisition:** Identifies shortages by cross-referencing requirements with MongoDB inventory collections and generates automated purchase orders.
- **Manager Oversight:** Centralized dashboard for reviewing and approving aggregated purchase lists prior to execution.

### Internal Communication & Technical Collaboration
Integrated communication infrastructure designed for a production environment:
- **Project-Based Chat:** Real-time communication channels between managers and carpenters for task-specific problem solving.
- **Collaborative Product Characterization:** A shared module allowing managers and professionals to define technical parameters, dimensions, and material types in coordination.
- **Automated Notification Framework:** Real-time system alerts (Status updates, Material arrivals, Production bottlenecks).

### Resource Optimization & Dispatching Algorithm
Developed a "Most-Available Professional" search algorithm:
- Analyzes current workload and active task counts for each professional in the system.
- Dispatches new tasks based on real-time availability and specialization to balance production flow.

### Production Lifecycle Management (PLM)
Comprehensive tracking of order statuses from initial characterization to delivery:
- Granular status monitoring (Pending, In-Production, QA, Completed).
- Management dashboard providing professional availability metrics and production efficiency reports.
- Advanced search and filtering capabilities for orders, materials, and personnel.

## Technical Stack
- **Frontend:** React.js (Functional Components, State Management)
- **Backend:** Node.js 
- **Database:** MongoDB (Complex Aggregations, Document Modeling)
- **System Analysis:** Full lifecycle analysis, from business constraints to NoSQL schema design and event-driven workflows.

---
Developed by Rivky
Fullstack Developer & Systems Analyst
