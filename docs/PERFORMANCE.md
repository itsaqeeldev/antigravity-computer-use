# Measuring desktop task latency

Use a real app task in Antigravity and preserve its exact build, model, input,
settings, prompt start time and final task receipt ID. Save all local test
artifacts under the checkout's ignored `.localdata/` directory. Keep hardware,
model and inference-setting changes visible in any comparison.

```text
node scripts/measure-run.mjs RECEIPTS PID TASK_START FINAL_RECEIPT OUTPUT
```

For example, use `123.18` as the final receipt if that was the task's final
status response. Later diagnostic polls are excluded. The report separates
controller execution, inter-call gaps and verification errors. Gaps include
host/model reasoning, terminal startup, image inspection and file tools; they
are not a measurement of model reasoning alone.

Verify exported bytes and actual native-engine completion separately. An app
can fail while every controller call succeeds. Failed exports do not qualify
as faster successful workflows. A different tile size or GPU is a different
workload; distinguish orchestration improvement from faster inference.

The current speed work reduces round trips through observation-bound exact
selectors, sequential action/wait batches, text-only section queries and shorter
skill instructions. It preserves native permission/identity checks, fresh
observations and independent Stop. A timed-out wait stops the batch without
replaying its earlier input. Real-app qualification remains separate from unit
tests and native component fixtures.
