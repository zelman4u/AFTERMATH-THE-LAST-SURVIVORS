using UnityEngine;

namespace Aftermath.Combat
{
    public class WeaponSystem : MonoBehaviour
    {
        public string weaponId = "glock_19";
        public float baseDamage = 32f;
        public int upgradeLevel = 1;
        public int magazineCapacity = 15;
        public int ammoInMagazine = 15;
        public float range = 48f;
        public Camera playerCamera;

        public float EffectiveDamage => baseDamage * (1f + (upgradeLevel - 1) * 0.22f);

        private void Update()
        {
            if (Input.GetButtonDown("Fire1")) TryFire();
            if (Input.GetKeyDown(KeyCode.R)) Reload();
        }

        public void TryFire()
        {
            if (ammoInMagazine <= 0 || playerCamera == null) return;
            ammoInMagazine--;

            Ray ray = playerCamera.ViewportPointToRay(new Vector3(0.5f, 0.5f, 0f));
            if (Physics.Raycast(ray, out RaycastHit hit, range))
            {
                hit.collider.SendMessage("TakeDamage", EffectiveDamage, SendMessageOptions.DontRequireReceiver);
            }
        }

        public void Reload()
        {
            ammoInMagazine = magazineCapacity;
        }
    }
}
