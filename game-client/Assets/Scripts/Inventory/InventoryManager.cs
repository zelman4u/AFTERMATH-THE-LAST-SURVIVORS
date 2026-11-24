using System;
using System.Collections.Generic;
using UnityEngine;

namespace Aftermath.Inventory
{
    [Serializable]
    public class InventorySlot
    {
        public string itemId;
        public int qty;
        public int upgradeLevel = 1;
    }

    public class InventoryManager : MonoBehaviour
    {
        public float maxWeightKg = 30f;
        public List<InventorySlot> items = new List<InventorySlot>();

        public bool AddItem(string itemId, int qty, float unitWeightKg)
        {
            if (qty <= 0 || CurrentWeightKg(unitWeightKg * qty) > maxWeightKg) return false;
            InventorySlot existing = items.Find(s => s.itemId == itemId);
            if (existing != null) existing.qty = Mathf.Min(999, existing.qty + qty);
            else items.Add(new InventorySlot { itemId = itemId, qty = qty });
            return true;
        }

        private float CurrentWeightKg(float additional) => additional + items.Count * 0.5f;
    }
}
