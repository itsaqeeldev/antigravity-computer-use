// Deterministic guidance accompanies errors; it never executes a retry.
export function recoveryAdvice(result){
 const code=result.error?.code||result.verification_error?.code;
 if(result.delivery_unknown===true||result.input_completed===true&&code||code==='input_outcome_unknown')return {next_action:'inspect_effect_without_replay',replay_allowed:false};
 if(['stale_observation','element_stale','window_moved','no_image','control_changed','focus_changed'].includes(code))return {next_action:'observe_again',replay_allowed:false};
 if(code==='window_minimized')return {next_action:'focus_target_then_observe',replay_allowed:false};
 if(code==='desktop_context_unavailable')return {next_action:'human_start_on_visible_desktop',replay_allowed:false};
 if(code==='version_mismatch')return {next_action:'resolve_version_mismatch',replay_allowed:false};
 if(code==='stop_persistence_failed')return {next_action:'inspect_stop_persistence_without_restart',replay_allowed:false};
 if(['permission_denied','approval_timeout','confirmation_required'].includes(code))return {next_action:'await_user_decision',replay_allowed:false};
 if(['control_stopped','control_inactive'].includes(code))return {next_action:'inspect_status_then_human_controls',replay_allowed:false};
 return {next_action:'inspect_diagnostics',replay_allowed:false};
}
