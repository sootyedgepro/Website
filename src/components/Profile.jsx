"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CreditCard, TrendingUp, Calendar, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// Converted from Rawki/profile.tsx → JSX. TypeScript interfaces and the
// forwardRef generic were stripped; the primary button and progress bar were
// nudged to Dex gold. Pass `userData` to override the placeholder demo data.
const Profile = React.forwardRef(
  ({ userData, onPurchaseCredits, onViewHistory, className }, ref) => {
    const defaultUserData = {
      name: "Alex Morgan",
      email: "alex.morgan@example.com",
      avatar:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop",
      initials: "AM",
      memberSince: "January 2024",
      credits: {
        current: 2450,
        total: 5000,
        renewalDate: "March 15, 2024",
        usagePercentage: 49,
      },
    };

    const user = userData || defaultUserData;
    const needsReup = user.credits.usagePercentage > 75;

    const containerVariants = {
      hidden: { opacity: 0, y: 20 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, staggerChildren: 0.1 },
      },
    };

    const itemVariants = {
      hidden: { opacity: 0, x: -20 },
      visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
    };

    return (
      <motion.div
        ref={ref}
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className={cn("w-full max-w-2xl mx-auto", className)}
      >
        <Card className="border-border/40 bg-gradient-to-br from-background via-muted/20 to-background shadow-lg">
          <CardHeader className="space-y-6 pb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <motion.div variants={itemVariants}>
                  <Avatar className="h-20 w-20 border-2 border-border/50 shadow-md">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="bg-muted text-lg font-semibold">
                      {user.initials}
                    </AvatarFallback>
                  </Avatar>
                </motion.div>
                <motion.div variants={itemVariants} className="space-y-1">
                  <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    {user.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <p className="text-xs text-muted-foreground/70">
                    Member since {user.memberSince}
                  </p>
                </motion.div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <motion.div variants={itemVariants}>
              <Card className="border-border/30 bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    Credit Balance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-4xl font-bold tracking-tight text-foreground">
                        {user.credits.current.toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        of {user.credits.total.toLocaleString()} credits
                      </p>
                    </div>
                    <Badge
                      variant={needsReup ? "destructive" : "secondary"}
                      className={cn(
                        "text-xs font-medium",
                        needsReup
                          ? "bg-destructive/10 text-destructive border-destructive/20"
                          : "bg-muted text-muted-foreground border-border/40"
                      )}
                    >
                      {user.credits.usagePercentage}% used
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <Progress
                      value={user.credits.usagePercentage}
                      className={cn(
                        "h-2",
                        needsReup ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"
                      )}
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Usage</span>
                      <span>
                        {user.credits.total - user.credits.current} credits used
                      </span>
                    </div>
                  </div>

                  {needsReup && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3"
                    >
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-destructive">
                          Low Credit Balance
                        </p>
                        <p className="text-xs text-muted-foreground">
                          You're running low on credits. Consider purchasing more to
                          continue uninterrupted service.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
              <Card className="border-border/30 bg-muted/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-muted p-2">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Renewal Date</p>
                      <p className="text-sm font-semibold text-foreground">
                        {user.credits.renewalDate}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/30 bg-muted/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-muted p-2">
                      <TrendingUp className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Daily Average</p>
                      <p className="text-sm font-semibold text-foreground">
                        {Math.round((user.credits.total - user.credits.current) / 30)}{" "}
                        credits
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row gap-3 pt-2"
            >
              <Button
                onClick={onPurchaseCredits}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                size="lg"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Purchase Credits
              </Button>
              <Button
                onClick={onViewHistory}
                variant="outline"
                className="flex-1 border-border/40 hover:bg-muted/50"
                size="lg"
              >
                View History
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }
);

Profile.displayName = "Profile";

export default Profile;
