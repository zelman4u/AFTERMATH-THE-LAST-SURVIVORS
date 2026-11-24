using UnityEngine;
using UnityEngine.UI;
using Aftermath.Survival;

namespace Aftermath.UI
{
    public class SurvivalHudController : MonoBehaviour
    {
        public SurvivalStats stats;
        public Slider healthSlider;
        public Slider hungerSlider;
        public Slider thirstSlider;

        private void Update()
        {
            if (stats == null) return;
            if (healthSlider != null) healthSlider.value = stats.health / 100f;
            if (hungerSlider != null) hungerSlider.value = stats.hunger / 100f;
            if (thirstSlider != null) thirstSlider.value = stats.thirst / 100f;
        }
    }
}
