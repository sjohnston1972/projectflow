import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("drills into the correctly filtered task metrics with stable controls", () => {
    const { container } = render(<App />);
    const openTasks = screen.getByRole("button", { name: /Open tasks/ });
    const myWorkload = screen.getByRole("button", { name: /My workload/ });

    expect(openTasks).toHaveAttribute("data-darwin-id", "metric-open-tasks");
    expect(openTasks).toHaveAttribute("type", "button");
    expect(openTasks).toHaveTextContent("3");
    expect(myWorkload).toHaveTextContent("2");

    openTasks.focus();
    expect(openTasks).toHaveFocus();
    fireEvent.click(openTasks);

    expect(screen.getByRole("heading", { name: "Open Tasks" })).toBeVisible();
    expect(screen.getByText("3 visible")).toBeVisible();
    expect(screen.getByText("Confirm launch checklist")).toBeVisible();
    expect(screen.getByText("Review release notes")).toBeVisible();
    expect(screen.getByText("Validate data export")).toBeVisible();
    expect(screen.queryByText("Summarise cohort results")).not.toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByRole(
        "button",
        { name: "Dashboard" },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /My workload/ }));

    expect(screen.getByRole("heading", { name: "My Work" })).toBeVisible();
    expect(screen.getByText("2 visible")).toBeVisible();
    expect(screen.getByText("Confirm launch checklist")).toBeVisible();
    expect(screen.getByText("Validate data export")).toBeVisible();
    expect(screen.queryByText("Review release notes")).not.toBeInTheDocument();
  });

  it("provides project and dashboard breadcrumb ancestors without duplicate current navigation", () => {
    const pushState = vi.spyOn(window.history, "pushState");
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^Dashboard/ }));
    expect(pushState).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Projects/ }));
    fireEvent.click(screen.getByRole("button", { name: /Apollo Release/ }));

    let breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(
      within(breadcrumb).getByRole("button", { name: "Projects" }),
    ).toBeVisible();
    expect(
      within(breadcrumb).queryByRole("button", { name: "Apollo Release" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Tasks/ }));
    breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    const projectAncestor = within(breadcrumb).getByRole("button", {
      name: "Apollo Release",
    });
    expect(
      within(breadcrumb).getByRole("button", { name: "Projects" }),
    ).toBeVisible();
    expect(within(breadcrumb).getByText("Tasks")).toHaveAttribute(
      "aria-current",
      "page",
    );

    projectAncestor.focus();
    expect(projectAncestor).toHaveFocus();
    fireEvent.click(projectAncestor);
    expect(screen.getByRole("heading", { name: "Apollo Release" })).toBeVisible();

    breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    fireEvent.click(within(breadcrumb).getByRole("button", { name: "Projects" }));
    expect(screen.getByRole("heading", { name: "Projects" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Reports/ }));
    breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    fireEvent.click(within(breadcrumb).getByRole("button", { name: "Dashboard" }));
    expect(screen.getByRole("heading", { name: "Good morning, Alex" })).toBeVisible();
    expect(pushState).toHaveBeenCalledTimes(7);
  });

  it("keeps summaries static while actionable dashboard surfaces remain focusable", () => {
    const { container } = render(<App />);
    const activeProjects = container.querySelector<HTMLElement>(
      '[data-darwin-id="metric-active-projects"]',
    );
    const teamVelocity = container.querySelector<HTMLElement>(
      '[data-darwin-id="metric-team-velocity"]',
    );
    const activityPanel = container.querySelector<HTMLElement>(
      '[data-darwin-id="dashboard-activity-panel"]',
    );

    expect(activeProjects?.tagName).toBe("SECTION");
    expect(teamVelocity?.tagName).toBe("SECTION");
    expect(activeProjects).toHaveClass("metric-static");
    expect(teamVelocity).toHaveClass("metric-static");
    expect(activeProjects).not.toHaveAttribute("tabindex");
    expect(activityPanel).not.toHaveAttribute("tabindex");

    const actionableIds = [
      "metric-open-tasks",
      "metric-my-workload",
      "dashboard-project-apollo",
      "activity-release-notes",
      "capacity-member-1",
      "upcoming-apollo-code-freeze",
    ];
    for (const id of actionableIds) {
      const control = container.querySelector<HTMLElement>(
        `[data-darwin-id="${id}"]`,
      );
      expect(control?.tagName).toBe("BUTTON");
      control?.focus();
      expect(control).toHaveFocus();
    }
    expect(
      container.querySelector("[draggable='true']"),
    ).not.toBeInTheDocument();
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

  it("retains more than 40 events in the session evidence stream", () => {
    window.history.replaceState({}, "", "/study");
    const { container } = render(<App />);
    const metric = container.querySelector<HTMLElement>(
      '[data-darwin-id="metric-active-projects"]',
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

    fireEvent.click(
      within(
        screen.getByRole("navigation", { name: "Primary navigation" }),
      ).getByRole("button", { name: /Dashboard/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Team member 1, 44% allocated" }),
    );
    expect(screen.getByRole("heading", { name: "Reports" })).toBeVisible();

    fireEvent.click(
      within(
        screen.getByRole("navigation", { name: "Primary navigation" }),
      ).getByRole("button", { name: /Dashboard/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Apollo code freeze/ }));
    expect(
      screen.getByRole("heading", { name: "Apollo Release" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Search project tasks")).toBeVisible();
  });
});
