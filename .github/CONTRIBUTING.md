# 🤝 Contributing to IconFlow

Thanks for your interest in contributing! This guide will help you get started.

## 📋 Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [How to Contribute](#how-to-contribute)
- [Code Style](#code-style)
- [Submitting Changes](#submitting-changes)

## 🚀 Getting Started

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/nameIess/IconFlow.git
   cd IconFlow
   ```
3. Open the project in your favorite editor to explore the codebase!

## 🛠️ Development Setup

To get the dev environment running locally:

- Install dependencies: `npm install`
- Start the dev server: `npm run dev`
- To run the backend and frontend concurrently, refer to the `start.bat` script or relevant documentation in the repository.

## 📁 Project Structure

```
IconFlow/
├── backend/        # Express.js API and controllers
├── frontend/       # React/Vite web application
├── .github/        # GitHub community health files
└── README.md       # Project documentation
```

## 💡 How to Contribute

### 🐛 Report Bugs

- Use the [Bug Report](ISSUE_TEMPLATE/bug_report.md) template
- Include your environment, steps to reproduce, and screenshots

### ✨ Suggest Features

- Use the [Feature Request](ISSUE_TEMPLATE/feature_request.md) template
- Check existing issues first to avoid duplicates

### 🔧 Submit Code

1. Create a branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Test thoroughly (see checklist below)
4. Commit: `git commit -m "feat: describe your change"`
5. Push: `git push origin feature/your-feature`
6. Open a Pull Request

## 🎨 Code Style

### General

- Use descriptive variable and function names
- Add comments for non-obvious logic

### JavaScript / Node.js

- Follow standard ESLint rules for the project
- Prefer ES6+ syntax (e.g., arrow functions, destructuring)
- Use standard Express.js controller and service abstractions for the backend
- Follow the shadcn/ui and Geist aesthetic guidelines for the frontend

## ✅ Before Submitting

- [ ] Changes work as expected locally
- [ ] No console errors or warnings
- [ ] Existing functionality is not broken
- [ ] Responsive design works on mobile and desktop devices

## 📜 Commit Message Format

Use conventional commits:

```
feat: add dark mode support
fix: resolve crash on empty input
docs: update README with new screenshots
style: improve button hover effects
refactor: extract auth logic into separate module
test: add unit tests for parser
chore: update dependencies
```
