import { useProfile } from "@/hooks/use-profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Target, Utensils, Activity, Dumbbell } from "lucide-react";

export default function ProfilePage() {
  const { data: profile, isLoading } = useProfile();

  if (isLoading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="animate-spin w-10 h-10 text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <User className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">No Profile Found</h2>
        <p className="text-muted-foreground">Please complete the onboarding process first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-3xl font-display font-bold">Your Profile</h1>
        <p className="text-muted-foreground">Your health stats and preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Goal</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary" className="text-lg capitalize px-4 py-2">
              {profile.goal}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Age</span>
              <span className="font-medium">{profile.age} years</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sex</span>
              <span className="font-medium capitalize">{profile.sex}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Weight</span>
              <span className="font-medium">{profile.weight} lbs</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Height</span>
              <span className="font-medium">{profile.height} cm</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Level</span>
              <span className="font-medium capitalize">{profile.activityLevel.replace("_", " ")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Training Days</span>
              <span className="font-medium">{profile.trainingDays} days/week</span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 lg:col-span-3">
          <CardHeader className="flex flex-row items-center gap-2">
            <Dumbbell className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Daily Macro Targets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-secondary rounded-lg">
                <div className="text-3xl font-bold font-display text-primary">{profile.targetCalories}</div>
                <div className="text-sm text-muted-foreground uppercase tracking-wider mt-1">Calories</div>
              </div>
              <div className="text-center p-4 bg-secondary rounded-lg">
                <div className="text-3xl font-bold font-display text-green-600 dark:text-green-400">{profile.targetProtein}g</div>
                <div className="text-sm text-muted-foreground uppercase tracking-wider mt-1">Protein</div>
              </div>
              <div className="text-center p-4 bg-secondary rounded-lg">
                <div className="text-3xl font-bold font-display text-blue-600 dark:text-blue-400">{profile.targetCarbs}g</div>
                <div className="text-sm text-muted-foreground uppercase tracking-wider mt-1">Carbs</div>
              </div>
              <div className="text-center p-4 bg-secondary rounded-lg">
                <div className="text-3xl font-bold font-display text-orange-600 dark:text-orange-400">{profile.targetFat}g</div>
                <div className="text-sm text-muted-foreground uppercase tracking-wider mt-1">Fat</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Utensils className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Meal Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Meals/Day</span>
              <span className="font-medium">{profile.mealsPerDay}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Snacks/Day</span>
              <span className="font-medium">{profile.snacksPerDay}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cooking Time</span>
              <span className="font-medium capitalize">{profile.cookingTime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Budget</span>
              <span className="font-medium capitalize">{profile.budgetMode}</span>
            </div>
          </CardContent>
        </Card>

        {profile.dietaryPreferences && profile.dietaryPreferences.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dietary Preferences</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {profile.dietaryPreferences.map((pref: string) => (
                  <Badge key={pref} variant="outline">{pref}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {profile.allergies && profile.allergies.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Allergies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {profile.allergies.map((allergy: string) => (
                  <Badge key={allergy} variant="destructive">{allergy}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
