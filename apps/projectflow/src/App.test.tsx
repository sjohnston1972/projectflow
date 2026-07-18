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

  it("runs the synthetic Darwin Lab task with a hidden success oracle", () => {
    window.history.replaceState(
      {},
      "",
      "/?study=true&lab=true&source=synthetic&studyId=projectflow-darwin-lab-test&participantId=lab-agent-01&sessionId=lab-session-test",
    );
    const { container } = render(<App />);

    expect(
      screen.getByRole("heading", { name: "Find Project Apollo assignees" }),
    ).toBeVisible();
    expect(screen.getByText("SYNTHETIC")).toBeVisible();
    expect(container).toHaveTextContent("Synthetic evidence only");
    expect(
      container.querySelector('[data-darwin-lab-ready="true"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-darwin-lab-oracle="success"]'),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Projects/ }));
    fireEvent.click(screen.getByRole("button", { name: /Project Apollo/ }));
    expect(screen.getAllByText("Sarah Wilson").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Jack Reid").length).toBeGreaterThan(1);
    expect(screen.getAllByText("David Bell").length).toBeGreaterThan(1);

    for (const person of ["Sarah Wilson", "Jack Reid", "David Bell"]) {
      fireEvent.click(screen.getByRole("checkbox", { name: person }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Submit selection" }));

    expect(
      screen.getByText("The complete assignment set was found."),
    ).toBeVisible();
    expect(
      container.querySelector('[data-darwin-lab-oracle="success"]'),
    ).not.toBeNull();
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
});
