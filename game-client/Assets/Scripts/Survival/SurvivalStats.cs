using UnityEngine;

namespace Aftermath.Survival
{
    public class SurvivalStats : MonoBehaviour
    {
        public float health = 100f;
        public float hunger = 90f;
        public float thirst = 90f;
        public float stamina = 100f;
        public float infection = 0f;
        public float temperature = 37f;

        private void Update()
        {
            float dt = Time.deltaTime;
            hunger = Mathf.Max(0f, hunger - 0.12f * dt);
            thirst = Mathf.Max(0f, thirst - 0.16f * dt);
            if (hunger <= 0f || thirst <= 0f || infection >= 85f)
            {
                health = Mathf.Max(0f, health - 1.5f * dt);
            }
        }

        public void ApplyDamage(float amount)
        {
            health = Mathf.Max(0f, health - amount);
        }
    }
}
