# Scheduled tasks

::: tip Availability
Scheduled tasks are available from v1.11.0 onward.
:::

Scheduled tasks trigger an existing script or batch task on a schedule, without clicking run each time. Create one under **定时** (Schedules) in the sidebar: pick a target, a time rule and an overlap policy, then enable it.

## Targets

- **A project script**: stored as a project ID plus script ID, so renaming the project or rescanning scripts keeps the target valid. If the target is deleted, the run fails with a reason.
- **A batch task**: runs the steps currently saved in the task. Scripts that are already running are reused, not started twice.

## Time rules

| Rule     | Settings                      | Meaning                                                         |
| -------- | ----------------------------- | --------------------------------------------------------------- |
| Once     | date and time                 | Runs once at the chosen time                                    |
| Daily    | `HH:mm`                       | Every day at the same time                                      |
| Weekly   | weekdays (multiple) + `HH:mm` | Local time; Sunday is `0`                                       |
| Interval | minutes (1 to 525600)         | Every N minutes from when it was enabled                        |
| Cron     | 5-field expression            | minute, hour, day, month, weekday; `*`, lists, ranges and steps |

All rules use this computer's local time. Cron uses the standard 5 fields (no seconds); when both day-of-month and weekday are restricted, both must match.

Changing a rule or re-enabling a task recalculates the next run. Disabled or deleted tasks do not trigger.

## When the target is already running

Each task has its own overlap policy:

- **Skip** (default): record a skip and leave the existing run alone.
- **Stop and restart**: stop the same target, then start a new run. If the script is also used by a batch task, stopping it affects that task too; the UI warns about this.

The latest result is **started**, **skipped** or **failed**, with a reason on failure. The task list shows the next run time.

## Boundaries

- Schedules work only while DevHub is running. They are not registered with Windows Task Scheduler, systemd or an Android background service. Work that comes due while DevHub is closed is not caught up: one-off tasks are marked skipped and repeating tasks move to their next future time.
- Tasks live in DevHub's own `userData/schedules.json`, not in your project directory or repository.
- Creating, editing, enabling and deleting tasks is desktop-only. Remote clients can list tasks and trigger **Run now**, but cannot change their definitions (ADR 0032).
- **Run now** obeys the same overlap policy.

The design decision is recorded in [ADR 0032](https://github.com/Delta1035/devhub/blob/main/docs/decisions/0032-scheduled-tasks.md).
