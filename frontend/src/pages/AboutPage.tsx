import { Link } from 'react-router-dom';
import { Zap, Code, Server, Globe, Cpu, MessageSquare, Laptop, Bot } from 'lucide-react';
import { Footer } from '../components/Footer';
import { HeaderThemeToggle } from '../components/HeaderThemeToggle';
import { Button } from '../components/Button';

export function AboutPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      {/* Header/Navigation */}
      <nav className="bg-gradient-to-b from-gray-900 to-gray-800 border-b border-gray-700 text-white">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-2">
              <Zap className="h-8 w-8 text-blue-500" />
              <span className="text-xl font-bold">FastAPI Stress Tester</span>
            </Link>
            <div className="flex items-center space-x-4">
              <Link to="/wizard">
                <Button variant="outline" className="bg-transparent text-gray-300 hover:text-white border-transparent hover:border-gray-600">
                  Dashboard
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" className="bg-transparent text-gray-300 hover:text-white border-gray-600">
                  Login
                </Button>
              </Link>
              <HeaderThemeToggle />
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-b from-blue-50 to-white dark:from-gray-800 dark:to-gray-900">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
              About <span className="text-blue-600 dark:text-blue-400">FastAPI Stress Tester</span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 leading-relaxed mb-8">
              We help developers build faster, more resilient FastAPI applications through modern, 
              intuitive load testing tools that identify performance bottlenecks before they affect your users.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/docs">
                <Button size="lg" variant="outline" className="flex items-center">
                  <Code className="mr-2 h-5 w-5" />
                  Documentation
                </Button>
              </Link>
              <Link to="/wizard">
                <Button size="lg" className="flex items-center">
                  <Zap className="mr-2 h-5 w-5" />
                  Try It Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Our Mission */}
      <section className="py-16 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Our Mission</h2>
              <div className="w-20 h-1 bg-blue-500 mx-auto"></div>
            </div>
            <div className="prose prose-lg mx-auto dark:prose-invert text-gray-700 dark:text-gray-300 space-y-8">
              <p className="text-lg leading-relaxed">
                At FastAPI Stress Tester, we believe that performance testing should be an integral part of the 
                development process, not an afterthought. Our mission is to provide developers with the tools 
                they need to build resilient, high-performance APIs from the ground up.
              </p>
              
              <p className="text-lg leading-relaxed">
                We've built FastAPI Stress Tester specifically for the FastAPI ecosystem, taking advantage of 
                FastAPI's built-in features like OpenAPI documentation to make load testing as seamless and 
                intuitive as possible. By focusing exclusively on FastAPI, we can provide a more tailored and 
                effective testing experience than generic load testing tools.
              </p>
              
              <p className="text-lg leading-relaxed">
                Our goal is to help developers identify and fix performance issues before they reach production, 
                saving time, resources, and reputation. We believe that with the right tools, building 
                high-performance APIs can be both straightforward and enjoyable.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features & Benefits */}
      <section className="py-16 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Why Choose Us</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              FastAPI Stress Tester offers unique advantages for developers working with FastAPI applications.
            </p>
            <div className="w-20 h-1 bg-blue-500 mx-auto mt-6"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-white dark:bg-gray-700 p-8 rounded-lg shadow-sm">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full w-14 h-14 flex items-center justify-center mb-6">
                <Server className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">FastAPI-Specific</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Tailored specifically for FastAPI applications, with automatic detection of routes, schemas, and authentication mechanisms.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-700 p-8 rounded-lg shadow-sm">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full w-14 h-14 flex items-center justify-center mb-6">
                <Cpu className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Intelligent Analysis</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Advanced analytics that not only show performance metrics but also identify potential root causes of bottlenecks.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-700 p-8 rounded-lg shadow-sm">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full w-14 h-14 flex items-center justify-center mb-6">
                <Globe className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Developer-Friendly</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Intuitive interface with a step wizard that guides you through the process of setting up and running load tests.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-16 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">The Team</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Meet the passionate developers behind FastAPI Stress Tester.
            </p>
            <div className="w-20 h-1 bg-blue-500 mx-auto mt-6"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-6xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 h-24"></div>
              <div className="relative px-6 pt-10 pb-6">
                <div className="absolute -top-16 left-1/2 transform -translate-x-1/2">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full w-24 h-24 flex items-center justify-center">
                    <Code className="h-12 w-12 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="text-center pt-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Hileamlak Yitayew</h3>
                  <p className="mt-4 text-gray-600 dark:text-gray-300 text-sm">
                    AB/SM CS and AB EE at Harvard '25. Teaching Fellow for Harvard's Systems Programming course and Software Engineer Intern at Microsoft specializing in distributed systems and performance optimization.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 h-24"></div>
              <div className="relative px-6 pt-10 pb-6">
                <div className="absolute -top-16 left-1/2 transform -translate-x-1/2">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full w-24 h-24 flex items-center justify-center">
                    <Laptop className="h-12 w-12 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="text-center pt-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Sibi Raja</h3>
                  <p className="mt-4 text-gray-600 dark:text-gray-300 text-sm">
                    Senior and concurrent Master's student at Harvard studying Computer Science and Statistics, focusing on systems programming and machine learning. Software Engineering Intern at Meta with interests in quantitative finance and high performance computing.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 h-24"></div>
              <div className="relative px-6 pt-10 pb-6">
                <div className="absolute -top-16 left-1/2 transform -translate-x-1/2">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full w-24 h-24 flex items-center justify-center">
                    <Bot className="h-12 w-12 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="text-center pt-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Aryan Naveen</h3>
                  <p className="mt-4 text-gray-600 dark:text-gray-300 text-sm">
                    Research Assistant at Harvard's Microrobotics Lab and Harvard Makerspace MakerFellow. Focused on autonomous flying micro robots and multi-agent reinforcement learning algorithms for collaborative systems.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 h-24"></div>
              <div className="relative px-6 pt-10 pb-6">
                <div className="absolute -top-16 left-1/2 transform -translate-x-1/2">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full w-24 h-24 flex items-center justify-center">
                    <MessageSquare className="h-12 w-12 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="text-center pt-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Jayson Lin</h3>
                  <p className="mt-4 text-gray-600 dark:text-gray-300 text-sm">
                    Harvard CS and Statistics student with SWE Co-op experience at Amazon Robotics and SWE Intern at Rockstar Games. Passionate about robotics, machine learning, and full-stack development with a background in fostering STEM education in rural communities.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-6">Have Questions?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            We're here to help you get the most out of FastAPI Stress Tester.
          </p>
          <a 
            href="mailto:ehmyitayew@college.harvard.edu" 
            className="inline-block px-8 py-3 bg-white text-blue-700 font-medium rounded-md hover:bg-gray-100 transition-colors"
          >
            Contact Us
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
