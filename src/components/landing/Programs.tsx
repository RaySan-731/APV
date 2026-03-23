import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, Users, Compass, Shield, TreePine, Star } from "lucide-react";

const programs = [
  {
    icon: Target,
    title: "Business Strategy",
    description: "Develop essential business strategy through practical market analysis and planning.",
    duration: "8 weeks",
    ageGroup: "All Levels\",
    skills: ["Strategy\", \"Market Analysis\", \"Planning\"],
  },
  {
    icon: Compass,
    title: "Venture Development\",
    description: \"Build and scale ventures through mentorship and resource planning.\",
    duration: \"6 weeks\",
    ageGroup: \"All Levels\",
    skills: [\"Growth\", \"Operations\", \"Management\"],
  },
  {
    icon: Shield,
    title: \"Risk Management\",
    description: \"Master risk assessment and mitigation strategies for successful ventures.\",
    duration: \"12 weeks\",
    ageGroup: \"All Levels\",
    skills: [\"Analysis\", \"Compliance\", \"Planning\"],
  },
  {
    icon: TreePine,
    title: "Environmental Stewardship",
    description: "Connect with nature and learn sustainable practices for environmental conservation.",
    duration: "10 weeks",
    ageGroup: "11-17 years",
    skills: ["Conservation", "Sustainability", "Wildlife"],
  },
  {
    icon: Users,
    title: "Team Building",
    description: "Strengthen collaboration and strategic partnerships for venture success.",
    duration: "4 weeks",
    ageGroup: "All Levels",
    skills: ["Collaboration", "Networking", "Partnership"],
  },
  {
    icon: Star,
    title: "Strategic Planning",
    description: "Develop long-term vision and comprehensive business strategies for growth.",
    duration: "Ongoing",
    ageGroup: "All Levels",
    skills: ["Strategy", "Planning", "Analytics"],
  },
];

export function Programs() {
  return (
    <section className="py-20 bg-gradient-earth">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">Our Programs</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Comprehensive training programs designed to develop well-rounded young leaders
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {programs.map((program, index) => (
            <Card key={index} className="hover:shadow-card transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <program.icon className="h-8 w-8 text-primary" />
                  <CardTitle>{program.title}</CardTitle>
                </div>
                <CardDescription>{program.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="font-medium">{program.duration}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Age Group:</span>
                    <span className="font-medium">{program.ageGroup}</span>
                  </div>
                  <div className="pt-3">
                    <p className="text-sm text-muted-foreground mb-2">Skills Developed:</p>
                    <div className="flex flex-wrap gap-2">
                      {program.skills.map((skill, i) => (
                        <Badge key={i} variant="secondary">{skill}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}