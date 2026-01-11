use crate::app_state::{ReconnectPolicy, ReconnectStats};
use std::time::Duration;
use tokio::time::sleep;

/// Ejecuta un reinicio con backoff exponencial
pub async fn reconnect_with_backoff<F, Fut, T>(
    name: &str,
    policy: &ReconnectPolicy,
    stats: &mut ReconnectStats,
    reconnect_fn: F,
) -> Result<T, anyhow::Error>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<T, anyhow::Error>>,
{
    if !policy.enabled {
        return reconnect_fn().await;
    }

    // Resetear contador si ha pasado suficiente tiempo estable
    if stats.should_reset_counter(policy) {
        log::info!("{}: Resetting reconnect counter after stable period", name);
        stats.consecutive_failures = 0;
    }

    let mut attempts = 0;
    let mut current_delay = policy.retry_delay_ms;

    loop {
        match reconnect_fn().await {
            Ok(result) => {
                stats.record_success();
                if attempts > 0 {
                    log::info!("{}: Reconnected successfully after {} attempts", name, attempts);
                }
                return Ok(result);
            }
            Err(e) => {
                attempts += 1;
                stats.record_restart();
                
                log::warn!(
                    "{}: Reconnect attempt {}/{} failed: {}",
                    name, attempts, policy.max_retries, e
                );

                if attempts >= policy.max_retries {
                    log::error!("{}: Max retries ({}) reached, giving up", name, policy.max_retries);
                    return Err(anyhow::anyhow!(
                        "{} failed after {} attempts: {}",
                        name, attempts, e
                    ));
                }

                // Calcular delay con backoff
                let delay_ms = calculate_backoff_delay(attempts, policy);
                log::info!("{}: Waiting {}ms before retry {}/{}...", 
                    name, delay_ms, attempts + 1, policy.max_retries);
                
                sleep(Duration::from_millis(delay_ms)).await;
                current_delay = delay_ms;
            }
        }
    }
}

/// Calcula el delay con backoff exponencial
fn calculate_backoff_delay(attempt: u32, policy: &ReconnectPolicy) -> u64 {
    let base_delay = policy.retry_delay_ms as f32;
    let multiplier = policy.backoff_multiplier;
    let max_delay = policy.max_delay_ms;
    
    let delay = base_delay * multiplier.powi(attempt as i32 - 1);
    let delay_ms = delay as u64;
    
    delay_ms.min(max_delay)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_backoff_calculation() {
        let policy = ReconnectPolicy {
            enabled: true,
            max_retries: 5,
            retry_delay_ms: 3000,
            backoff_multiplier: 2.0,
            max_delay_ms: 60000,
            reset_counter_after_ms: 300000,
        };

        assert_eq!(calculate_backoff_delay(1, &policy), 3000);
        assert_eq!(calculate_backoff_delay(2, &policy), 6000);
        assert_eq!(calculate_backoff_delay(3, &policy), 12000);
        assert_eq!(calculate_backoff_delay(4, &policy), 24000);
        assert_eq!(calculate_backoff_delay(5, &policy), 48000);
        
        // Verificar que no exceda max_delay
        assert_eq!(calculate_backoff_delay(10, &policy), 60000);
    }

    #[tokio::test]
    async fn test_reconnect_success_on_first_try() {
        let policy = ReconnectPolicy::default();
        let mut stats = ReconnectStats::default();
        
        let result = reconnect_with_backoff(
            "test",
            &policy,
            &mut stats,
            || async { Ok(42) }
        ).await;
        
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
        assert_eq!(stats.consecutive_failures, 0);
    }

    #[tokio::test]
    async fn test_reconnect_max_retries() {
        let policy = ReconnectPolicy {
            enabled: true,
            max_retries: 3,
            retry_delay_ms: 10,
            backoff_multiplier: 1.5,
            max_delay_ms: 1000,
            reset_counter_after_ms: 10000,
        };
        let mut stats = ReconnectStats::default();
        
        let result = reconnect_with_backoff(
            "test",
            &policy,
            &mut stats,
            || async { Err(anyhow::anyhow!("Always fails")) }
        ).await;
        
        assert!(result.is_err());
        assert_eq!(stats.restarts, 3);
    }
}
