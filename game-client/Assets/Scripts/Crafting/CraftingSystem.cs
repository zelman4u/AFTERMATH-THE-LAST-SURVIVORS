using System;
using System.Collections.Generic;
using UnityEngine;

namespace Aftermath.Crafting
{
    [Serializable]
    public class CraftingRecipeData
    {
        public string recipeId;
        public string outputItemId;
        public int workbenchLevel = 1;
        public List<string> requiredItemIds = new List<string>();
    }

    public class CraftingSystem : MonoBehaviour
    {
        public int workbenchLevel = 1;
        public List<CraftingRecipeData> recipes = new List<CraftingRecipeData>();

        public bool CanCraft(CraftingRecipeData recipe) =>
            recipe != null && workbenchLevel >= recipe.workbenchLevel;
    }
}
