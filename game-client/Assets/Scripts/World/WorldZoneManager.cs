using UnityEngine;

namespace Aftermath.World
{
    public class WorldZoneManager : MonoBehaviour
    {
        public int currentDay = 1;
        [Range(0f, 24f)] public float timeOfDay = 8f;
        public float dayLengthSeconds = 240f;
        public Light sunLight;

        private void Update()
        {
            timeOfDay += (24f / dayLengthSeconds) * Time.deltaTime;
            if (timeOfDay >= 24f)
            {
                timeOfDay -= 24f;
                currentDay++;
            }

            if (sunLight != null)
            {
                float sunAngle = ((timeOfDay / 24f) * 360f) - 90f;
                sunLight.transform.rotation = Quaternion.Euler(sunAngle, 35f, 0f);
            }
        }
    }
}
