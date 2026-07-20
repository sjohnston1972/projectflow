import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "./App";

describe("standalone ProjectFlow", () => {
  it("explains the product on the default dashboard", () => {
    render(<App />);

    expect(
      screen.getByText(
        "ProjectFlow is a task management platform for creating projects, assigning tasks, and coordinating work with project members.",
      ),
    ).toBeVisible();
  });

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("creates and persists a functional project", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Projects/ }));
    fireEvent.click(screen.getByRole("button", { name: /New project/ }));
    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "Polaris Launch" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(
      screen.getByRole("heading", { name: "Polaris Launch" }),
    ).toBeInTheDocument();
    expect(localStorage.getItem("projectflow:workspace:v1")).toContain(
      "Polaris Launch",
    );
  });

  it("records a verified study attempt through the indirect task path", () => {
    window.history.replaceState({}, "", "/study");
    render(<App />);

    expect(
      screen.queryByRole("button", { name: /^Tasks/ }),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Session evidence" }),
    ).toBeVisible();
    expect(screen.queryByText("Complete three tasks")).not.toBeInTheDocument();
    expect(screen.queryByText("Optional feedback")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Projects/ }));
    fireEvent.click(screen.getByRole("button", { name: /Apollo Release/ }));
    fireEvent.click(screen.getByRole("button", { name: /Tasks/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /Confirm launch checklist/ }),
    );

    expect(screen.getByText("task completed")).toBeInTheDocument();
    expect(screen.getByText(/events/)).toBeInTheDocument();
  });

  it("enters measured study mode from a GitHub Pages query URL", () => {
    window.history.replaceState({}, "", "/projectflow/?study=true");
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Session evidence" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Study mode" }),
    ).not.toBeInTheDocument();
  });

  it("links directly from the primary navigation to My work", () => {
    window.history.replaceState({}, "", "/study/dashboard");
    render(<App />);

    const link = screen.getByRole("link", { name: "My work" });
    expect(link).toHaveAttribute("href", "/study/my-work");

    link.focus();
    expect(link).toHaveFocus();
    fireEvent.click(link);

    expect(window.location.pathname).toBe("/study/my-work");
    expect(screen.getByRole("heading", { name: "My Work" })).toBeVisible();
  });

  it("runs a configurable Darwin Lab task without a target-side oracle", () => {
    window.history.replaceState(
      {},
      "",
      "/study/projects?study=true&lab=true&source=automated&studyId=projectflow-darwin-lab-test&participantId=lab-agent-01&sessionId=lab-session-test&experimentId=lab-experiment-test&runId=lab-run-test&taskId=review-projects&appVersion=baseline&taskDefinitionId=lab-task-test&taskDefinitionHash=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    const { container } = render(<App />);

    expect(screen.getByRole("heading", { name: "Projects" })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Session evidence" }),
    ).toBeVisible();
    expect(
      container.querySelector('[data-darwin-lab-ready="true"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-darwin-lab-oracle="success"]'),
    ).toBeNull();

    fireEvent.click(
      container.querySelector('[data-darwin-id="project-open-apollo"]')!,
    );
    expect(
      screen.getByRole("heading", { name: "Apollo Release" }),
    ).toBeVisible();
    expect(window.location.pathname).toBe("/study/projects/apollo");
    expect(screen.getByText("task started")).toBeVisible();
    expect(container).not.toHaveTextContent("SYNTHETIC");
  });

  it("retains more than 40 events in the session evidence stream", () => {
    window.history.replaceState({}, "", "/study");
    const { container } = render(<App />);
    const metric = container.querySelector<HTMLElement>(
      '[data-darwin-id="metric-open-tasks"]',
    );

    expect(metric).not.toBeNull();
    for (let click = 0; click < 45; click += 1) {
      fireEvent.click(metric!);
    }

    const eventCount = Number.parseInt(
      screen.getByLabelText("Captured events").textContent ?? "0",
      10,
    );
    expect(eventCount).toBeGreaterThan(40);
    expect(container.querySelectorAll(".live-event-row")).toHaveLength(
      eventCount,
    );
  });

  it("makes dashboard activity, capacity, and upcoming tiles actionable", () => {
    window.history.replaceState({}, "", "/study");
    const { container } = render(<App />);

    expect(
      container.querySelector('[data-darwin-id="activity-release-notes"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-darwin-id="dashboard-activity-panel"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-darwin-id="panel-heading-capacity"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-darwin-id="capacity-member-1"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-darwin-id="upcoming-apollo-code-freeze"]'),
    ).not.toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: /Release notes approved/ }),
    );
    expect(
      screen.getByRole("heading", { name: "Apollo Release" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Dashboard/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Team member 1, 44% allocated" }),
    );
    expect(screen.getByRole("heading", { name: "Reports" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Dashboard/ }));
    fireEvent.click(screen.getByRole("button", { name: /Apollo code freeze/ }));
    expect(
      screen.getByRole("heading", { name: "Apollo Release" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Search project tasks")).toBeVisible();
  });

  it("captures privacy-safe intent across Settings and route whitespace", () => {
    window.history.replaceState({}, "", "/study");
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    const workspaceName = container.querySelector<HTMLElement>(
      '[data-darwin-id="settings-workspace-name"]',
    );
    const settingsContent = container.querySelector<HTMLElement>(
      '[data-darwin-id="workspace-settings-content"]',
    );

    expect(workspaceName).not.toBeNull();
    expect(settingsContent).not.toBeNull();
    fireEvent.pointerOver(workspaceName!, { pointerType: "mouse" });
    fireEvent.click(workspaceName!);
    fireEvent.pointerOut(workspaceName!, { pointerType: "mouse" });
    fireEvent.click(settingsContent!);

    expect(screen.getAllByText(/settings-workspace-name/).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText(/workspace-settings-content/).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText("false affordance").length).toBeGreaterThan(0);
  });
});
