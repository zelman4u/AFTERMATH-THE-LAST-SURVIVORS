using UnityEngine;

namespace Aftermath.Building
{
    public class BaseBuilder : MonoBehaviour
    {
        public GameObject[] structurePrefabs;
        public LayerMask terrainMask;

        public GameObject PlaceStructure(int prefabIndex, Vector3 worldPos, float yawDegrees)
        {
            if (structurePrefabs == null || prefabIndex < 0 || prefabIndex >= structurePrefabs.Length)
            {
                return null;
            }
            return Instantiate(structurePrefabs[prefabIndex], worldPos, Quaternion.Euler(0f, yawDegrees, 0f));
        }
    }
}
